

const pool = require("../src/config/database");
const { getPhilippineDate } = require("../utils/dateTime");
const supabase = require("../src/config/supabase");
const crypto = require("crypto");


const timeIn = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const photo = req.file;

        // Validate coordinates
        const lat = Number(latitude);
        const lon = Number(longitude);

        if (
            latitude === undefined ||
            longitude === undefined ||
            String(latitude).trim() === "" ||
            String(longitude).trim() === "" ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 || lat > 90 ||
            lon < -180 || lon > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required."
            });
        }

        // Require a photo proof
        if (!photo || !photo.buffer) {
            return res.status(400).json({
                success: false,
                message: "A photo proof is required for time-in."
            });
        }

        // Verify the actual image file signature
        const buffer = photo.buffer;

        const isJpeg =
            buffer.length >= 3 &&
            buffer[0] === 0xFF &&
            buffer[1] === 0xD8 &&
            buffer[2] === 0xFF;

        const isPng =
            buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(
                Buffer.from([
                    0x89, 0x50, 0x4E, 0x47,
                    0x0D, 0x0A, 0x1A, 0x0A
                ])
            );

        const isWebp =
            buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP";

        const validImageSignature =
            (photo.mimetype === "image/jpeg" && isJpeg) ||
            (photo.mimetype === "image/png" && isPng) ||
            (photo.mimetype === "image/webp" && isWebp);

        if (!validImageSignature) {
            return res.status(400).json({
                success: false,
                message: "Please upload a valid JPEG, PNG, or WEBP image."
            });
        }

        // 1. Find the student's OJT profile
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

        // 2. Find the student's assigned geofence
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

        // 3. Calculate distance from student's location
        const toRadians = (degrees) => degrees * (Math.PI / 180);

        const earthRadius = 6371000;

        const lat1 = toRadians(Number(geofence.latitude));
        const lat2 = toRadians(lat);

        const deltaLat = toRadians(lat - Number(geofence.latitude));
        const deltaLon = toRadians(lon - Number(geofence.longitude));

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

        // 4. Check if student is inside the geofence
        const insideGeofence =
            distanceMeters <= Number(geofence.radius_meters);

        if (!insideGeofence) {
            return res.status(403).json({
                success: false,
                message: "You are outside your approved OJT location.",
                inside_geofence: false,
                distance_meters: Number(distanceMeters.toFixed(2)),
                allowed_radius_meters: geofence.radius_meters
            });
        }

        // 5. Get today's date in the Philippines
        const today = getPhilippineDate();

        // 6. Check if student already timed in today
        const existingAttendance = await pool.query(
            `SELECT *
             FROM attendance
             WHERE user_id = $1
             AND attendance_date = $2`,
            [req.user.id, today]
        );

        if (existingAttendance.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "You have already timed in today."
            });
        }

        // 7. Prepare a unique photo filename
        const extensionByMimeType = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };

        const extension = extensionByMimeType[photo.mimetype];

        if (!extension) {
            return res.status(400).json({
                success: false,
                message: "Only JPEG, PNG, and WEBP photos are allowed."
            });
        }

        const fileName = `${crypto.randomUUID()}.${extension}`;

        const photoPath = `${req.user.id}/${today}/${fileName}`;

        // 8. Upload the photo to the private Supabase Storage bucket
        const { error: uploadError } = await supabase.storage
            .from("ojt-photo-proofs")
            .upload(photoPath, photo.buffer, {
                contentType: photo.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error("Photo upload error:", uploadError);

            return res.status(500).json({
                success: false,
                message: "Failed to upload photo proof. Please try again."
            });
        }

        // 9. Create attendance record with photo path
        try {
            const result = await pool.query(
                `INSERT INTO attendance
                    (
                        user_id,
                        geofence_id,
                        attendance_date,
                        time_in,
                        latitude_in,
                        longitude_in,
                        time_in_status,
                        photo_proof_path
                    )
                 VALUES
                    ($1, $2, $3, NOW(), $4, $5, 'VALID', $6)
                 RETURNING *`,
                [
                    req.user.id,
                    geofence.id,
                    today,
                    lat,
                    lon,
                    photoPath
                ]
            );

            return res.status(201).json({
                success: true,
                message: "Time-in recorded successfully.",
                attendance: result.rows[0],
                geofence_check: {
                    inside_geofence: true,
                    distance_meters: Number(distanceMeters.toFixed(2)),
                    allowed_radius_meters: geofence.radius_meters
                }
            });

        } catch (databaseError) {
            // Remove the uploaded photo if saving attendance fails
            const { error: cleanupError } = await supabase.storage
                .from("ojt-photo-proofs")
                .remove([photoPath]);

            if (cleanupError) {
                console.error("Photo cleanup error:", cleanupError);
            }

            throw databaseError;
        }

    } catch (error) {
        console.error("Time-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

const timeOut = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required."
            });
        }

        // 1. Find the student's OJT profile
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

        // 2. Find the student's assigned geofence
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

        // 3. Calculate distance from student's location
        const toRadians = (degrees) => degrees * (Math.PI / 180);

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

        // 4. Check if student is inside the geofence
        const insideGeofence =
            distanceMeters <= geofence.radius_meters;

        if (!insideGeofence) {
            return res.status(403).json({
                success: false,
                message: "You are outside your approved OJT location.",
                inside_geofence: false,
                distance_meters: Number(distanceMeters.toFixed(2)),
                allowed_radius_meters: geofence.radius_meters
            });
        }

        // 5. Get today's date in the Philippines
        const today = getPhilippineDate();

        // 6. Find today's attendance record
        const attendanceResult = await pool.query(
            `SELECT *
             FROM attendance
             WHERE user_id = $1
             AND attendance_date = $2`,
            [req.user.id, today]
        );

        if (attendanceResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No Time In record found for today."
            });
        }

        const attendance = attendanceResult.rows[0];

        // 7. Check if already timed out
        if (attendance.time_out !== null) {
            return res.status(409).json({
                success: false,
                message: "You have already timed out today."
            });
        }

        // 8. Record Time Out
        const result = await pool.query(
            `UPDATE attendance
             SET
                time_out = NOW(),
                latitude_out = $1,
                longitude_out = $2,
                time_out_status = 'VALID'
             WHERE id = $3
             RETURNING *`,
            [
                latitude,
                longitude,
                attendance.id
            ]
        );

        const updatedAttendance = result.rows[0];

        // 9. Calculate hours worked
        const timeInDate = new Date(updatedAttendance.time_in);
        const timeOutDate = new Date(updatedAttendance.time_out);


const workedMilliseconds = timeOutDate - timeInDate;
const workedSeconds = Math.floor(workedMilliseconds / 1000);

const hoursWorked = Math.floor(workedSeconds / 3600);
const minutesWorked = Math.floor((workedSeconds % 3600) / 60);
const secondsWorked = workedSeconds % 60;

        // 10. Return attendance and worked-hours information
        return res.json({
            success: true,
            message: "Time-out recorded successfully.",
            attendance: updatedAttendance,
hours_worked: {
    hours: hoursWorked,
    minutes: minutesWorked,
    seconds: secondsWorked,
    display: `${hoursWorked}h ${minutesWorked}m ${secondsWorked}s`
},
            geofence_check: {
                inside_geofence: true,
                distance_meters: Number(distanceMeters.toFixed(2)),
                allowed_radius_meters: geofence.radius_meters
            }
        });

    } catch (error) {
        console.error("Time-out error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


const getMyAttendanceHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT
                id,
                TO_CHAR(attendance_date, 'YYYY-MM-DD') AS attendance_date,
                time_in,
                time_out,
                latitude_in,
                longitude_in,
                latitude_out,
                longitude_out,
                time_in_status,
                time_out_status,
                CASE
                    WHEN time_in IS NOT NULL AND time_out IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (time_out - time_in))
                    ELSE 0
                END AS seconds_worked
             FROM attendance
             WHERE user_id = $1
             ORDER BY attendance_date DESC`,
            [userId]
        );

        let totalSeconds = 0;

        const attendance = result.rows.map((record) => {
            const secondsWorked = Number(record.seconds_worked) || 0;
            totalSeconds += secondsWorked;

            return {
                ...record,
                seconds_worked: secondsWorked,
                hours_worked: Number(
                    (secondsWorked / 3600).toFixed(2)
                )
            };
        });

        return res.json({
            success: true,
            count: attendance.length,
            total_hours: Number((totalSeconds / 3600).toFixed(2)),
            attendance
        });
    } catch (error) {
        console.error("Get attendance history error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching attendance history."
        });
    }
};


const getAttendancePhotoProof = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        // 1. Find the attendance record and its photo path
        const result = await pool.query(
            `SELECT id, user_id, photo_proof_path
             FROM attendance
             WHERE id = $1
             LIMIT 1`,
            [attendanceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found."
            });
        }

        const attendance = result.rows[0];

        if (!attendance.photo_proof_path) {
            return res.status(404).json({
                success: false,
                message: "No photo proof is available for this attendance."
            });
        }

        // 2. Allow the student who owns this attendance record
        const isOwner = attendance.user_id === req.user.id;

        // 3. Otherwise, check whether the requester is
        // the supervisor linked to this student
        let isAssignedSupervisor = false;

        if (!isOwner && req.user.role === "SUPERVISOR") {
            const supervisorCheck = await pool.query(
                `SELECT 1
                 FROM weekly_reports
                 WHERE user_id = $1
                   AND supervisor_id = $2
                 LIMIT 1`,
                [attendance.user_id, req.user.id]
            );

            isAssignedSupervisor =
                supervisorCheck.rows.length > 0;
        }

        if (!isOwner && !isAssignedSupervisor) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this photo proof."
            });
        }

        // 4. Generate a temporary link to the private photo
        const { data, error } = await supabase.storage
            .from("ojt-photo-proofs")
            .createSignedUrl(
                attendance.photo_proof_path,
                300
            );

        if (error || !data?.signedUrl) {
            console.error("Signed URL error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve the photo proof."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Photo proof retrieved successfully.",
            photo_url: data.signedUrl,
            expires_in_seconds: 300
        });

    } catch (error) {
        console.error("Get photo proof error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while retrieving the photo proof."
        });
    }
};

module.exports = {
    timeIn,
    timeOut,
    getMyAttendanceHistory,
    getAttendancePhotoProof
};