
const {
  signLocation,
} = require("../utils/locationTicket");

const searchPlaces = async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (query.length < 3 || query.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Enter between 3 and 150 characters.",
      });
    }

    const apiKey = process.env.GEOAPIFY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Geoapify API key is missing.",
      });
    }

    const url = new URL(
      "https://api.geoapify.com/v1/geocode/autocomplete"
    );

    url.searchParams.set("text", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("filter", "countrycode:ph");
    url.searchParams.set("limit", "7");
    url.searchParams.set("lang", "en");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: "Location search is unavailable.",
      });
    }

    const data = await response.json();

    // For a 100-meter geofence, reject broad
    // results such as entire cities or streets.
    const acceptedTypes = new Set([
      "amenity",
      "building",
    ]);

    const suggestions = (data.results || [])
      .filter((place) => {
        return (
          acceptedTypes.has(place.result_type) &&
          Number.isFinite(Number(place.lat)) &&
          Number.isFinite(Number(place.lon)) &&
          place.formatted
        );
      })
      .map((place) => {
        const location = {
          name:
            place.name ||
            place.address_line1 ||
            place.formatted,
          address: place.formatted,
          latitude: Number(place.lat),
          longitude: Number(place.lon),
        };

        return {
          name: location.name,
          address: location.address,
          result_type: place.result_type,
          location_token: signLocation(
            location,
            req.user.id
          ),
        };
      });

    return res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("Places search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search workplace.",
    });
  }
};

module.exports = {
  searchPlaces,
};
