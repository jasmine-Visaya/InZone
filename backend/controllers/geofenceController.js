
const pool = require("../src/config/database");

const checkGeofence = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const lat = Number(latitude);
    const lon = Number(longitude);

    // Validate GPS coordinates
    if (
      latitude === undefined ||
      latitude === null ||
      latitude === "" ||
      longitude === undefined ||
      longitude === null ||
      longitude === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required.",
      });
    }

    // Get student's OJT profile and approval status
    const profileResult = await pool.query(
      `SELECT id, approval_status
       FROM ojt_profiles
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    const profile = profileResult.rows[0];

    // Block students whose profiles are not approved
    if (profile.approval_status !== "APPROVED") {
      const status = profile.approval_status;

      return res.status(403).json({
        success: false,
        code: "OJT_NOT_APPROVED",
        approval_status: status,
        message:
          status === "REJECTED"
            ? "Your OJT profile was rejected. Please update and resubmit your profile."
            : "Your OJT profile is pending approval. GPS attendance will be available once approved.",
      });
    }

    const ojtProfileId = profile.id;

    // Get approved student's geofence
    const geofenceResult = await pool.query(
      `SELECT *
       FROM geofences
       WHERE ojt_profile_id = $1`,
      [ojtProfileId]
    );

    if (geofenceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Geofence not found.",
      });
    }

    const geofence = geofenceResult.rows[0];

    // Haversine distance calculation
    const toRadians = (degrees) =>
      degrees * (Math.PI / 180);

    const centerLat = Number(geofence.latitude);
    const centerLon = Number(geofence.longitude);
    const radius = Number(geofence.radius_meters);

    const earthRadius = 6371000;

    const lat1 = toRadians(centerLat);
    const lat2 = toRadians(lat);

    const deltaLat = toRadians(lat - centerLat);
    const deltaLon = toRadians(lon - centerLon);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

    const distanceMeters = earthRadius * c;

    const insideGeofence =
      distanceMeters <= radius;

    return res.json({
      success: true,
      inside_geofence: insideGeofence,
      distance_meters: Number(distanceMeters.toFixed(2)),
      geofence: {
        id: geofence.id,
        name: geofence.name,
        radius_meters: radius,
      },
    });

  } catch (error) {
    console.error("Check geofence error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const getMyApprovedGeofence = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.approval_status,
         g.id,
         g.name,
         g.address,
         g.latitude,
         g.longitude,
         g.radius_meters
       FROM ojt_profiles p
       LEFT JOIN geofences g
         ON g.ojt_profile_id = p.id
       WHERE p.user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "OJT profile not found.",
      });
    }

    const record = result.rows[0];

    // Never expose the geofence location
    // until the OJT profile is approved.
    if (record.approval_status !== "APPROVED") {
      return res.status(403).json({
        success: false,
        code: "OJT_NOT_APPROVED",
        approval_status: record.approval_status,
        message: "OJT workplace is not approved yet.",
      });
    }

    if (
      record.id === null ||
      record.latitude === null ||
      record.longitude === null
    ) {
      return res.status(404).json({
        success: false,
        message: "Approved workplace geofence not found.",
      });
    }

    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);
    const radius = Number(record.radius_meters);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(radius) ||
      radius <= 0
    ) {
      return res.status(500).json({
        success: false,
        message: "Workplace geofence configuration is invalid.",
      });
    }

    return res.json({
      success: true,
      geofence: {
        id: record.id,
        name: record.name,
        address: record.address,
        latitude,
        longitude,
        radius_meters: radius,
      },
    });
  } catch (error) {
    console.error("Get workplace geofence error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve workplace location.",
    });
  }
};

module.exports = {
  checkGeofence,
  getMyApprovedGeofence,
};
