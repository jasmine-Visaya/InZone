const pool = require("../src/config/database");

const createGeofence = async (req, res) => {
    try {
        const {
            name,
            address,
            latitude,
            longitude,
            radius_meters
        } = req.body;

        // Check required fields
        if (
            !name ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, latitude, and longitude are required."
            });
        }

        // Find the student's OJT profile
        const profileResult = await pool.query(
            `SELECT id
             FROM ojt_profiles
             WHERE user_id = $1`,
            [req.user.id]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "OJT profile not found."
            });
        }

        const ojtProfileId = profileResult.rows[0].id;

        // Check if a geofence already exists for this OJT profile
        const existingGeofence = await pool.query(
            `SELECT id
             FROM geofences
             WHERE ojt_profile_id = $1`,
            [ojtProfileId]
        );

        if (existingGeofence.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A geofence already exists for this OJT profile."
            });
        }

        // Create geofence
        const result = await pool.query(
            `INSERT INTO geofences
                (
                    name,
                    address,
                    latitude,
                    longitude,
                    radius_meters,
                    ojt_profile_id
                )
             VALUES
                ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                name,
                address || null,
                latitude,
                longitude,
                radius_meters || 100,
                ojtProfileId
            ]
        );

        res.status(201).json({
            success: true,
            message: "Geofence created successfully.",
            geofence: result.rows[0]
        });

    } catch (error) {
        console.error("Create geofence error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

const checkGeofence = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required."
            });
        }

        // Get the student's OJT profile
        const profileResult = await pool.query(
            `SELECT id
             FROM ojt_profiles
             WHERE user_id = $1`,
            [req.user.id]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "OJT profile not found."
            });
        }

        const ojtProfileId = profileResult.rows[0].id;

        // Get the geofence assigned to the OJT profile
        const geofenceResult = await pool.query(
            `SELECT *
             FROM geofences
             WHERE ojt_profile_id = $1`,
            [ojtProfileId]
        );

        if (geofenceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Geofence not found."
            });
        }

        const geofence = geofenceResult.rows[0];

        // Convert degrees to radians
        const toRadians = (degrees) => degrees * (Math.PI / 180);

        // Haversine formula
        const earthRadius = 6371000;

        const lat1 = toRadians(geofence.latitude);
        const lat2 = toRadians(latitude);

        const deltaLat = toRadians(latitude - geofence.latitude);
        const deltaLon = toRadians(longitude - geofence.longitude);

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
            distanceMeters <= geofence.radius_meters;

        res.json({
            success: true,
            inside_geofence: insideGeofence,
            distance_meters: Number(distanceMeters.toFixed(2)),
            geofence: {
                id: geofence.id,
                name: geofence.name,
                radius_meters: geofence.radius_meters
            }
        });

    } catch (error) {
        console.error("Check geofence error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

module.exports = {
    createGeofence,
    checkGeofence
};