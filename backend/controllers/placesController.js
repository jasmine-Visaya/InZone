const { signLocation } = require("../utils/locationTicket");

// =====================================
// SEARCH WORKPLACE LOCATIONS
// GET /api/places/autocomplete?q=
// =====================================
const searchPlaces = async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    // Validate search query
    if (query.length < 3 || query.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Enter between 3 and 150 characters.",
      });
    }

    // Get API key from backend environment
    const apiKey = process.env.GEOAPIFY_API_KEY?.trim();

    if (!apiKey) {
      console.error("GEOAPIFY_API_KEY is not configured.");

      return res.status(500).json({
        success: false,
        message:
          "Geoapify API key is missing. Please contact the administrator.",
      });
    }

    // Correct Geoapify autocomplete endpoint
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");

    // Search parameters
    url.searchParams.set("text", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:ph");
    url.searchParams.set("limit", "7");
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", apiKey);

    // Request places from Geoapify
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error("Geoapify request failed:", response.status);

      return res.status(502).json({
        success: false,
        message:
          "Location search is temporarily unavailable. Please try again.",
      });
    }

    const data = await response.json();

    // For the 100-meter geofence,
    // accept building-level and amenity locations only.
    const acceptedTypes = new Set(["amenity", "building"]);

    const results = Array.isArray(data.results) ? data.results : [];

    const suggestions = results
      .filter((place) => {
        const latitude = Number(place.lat);
        const longitude = Number(place.lon);

        return (
          acceptedTypes.has(place.result_type) &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180 &&
          Boolean(place.formatted)
        );
      })
      .map((place) => {
        const location = {
          name: place.name || place.address_line1 || place.formatted,

          address: place.formatted,

          latitude: Number(place.lat),
          longitude: Number(place.lon),
        };

        // Do not expose raw coordinates.
        // Generate a signed location ticket
        // tied to the authenticated student.
        return {
          name: location.name,
          address: location.address,
          result_type: place.result_type,

          location_token: signLocation(location, req.user.id),
        };
      });

    return res.status(200).json({
      success: true,
      count: suggestions.length,
      suggestions,
    });
  } catch (error) {
    console.error("Places search error:", error);

    if (error.name === "TimeoutError") {
      return res.status(504).json({
        success: false,
        message: "Location search timed out. Please try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to search workplace.",
    });
  }
};

module.exports = {
  searchPlaces,
};
