
const pool = require("../src/config/database");
const { getPhilippineDate } = require("../utils/dateTime");
const supabase = require("../src/config/supabase");
const crypto = require("crypto");

/* =========================================
   HELPER: VALIDATE GPS COORDINATES
========================================= */

function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  const valid =
    latitude !== undefined &&
    latitude !== null &&
    String(latitude).trim() !== "" &&
    longitude !== undefined &&
    longitude !== null &&
    String(longitude).trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;

  return {
    valid,
    latitude: lat,
    longitude: lon,
  };
}

/* =========================================
   HELPER: CHECK OJT PROFILE APPROVAL
========================================= */

async function getApprovedOjtProfile(userId) {
  const result = await pool.query(
    `SELECT id, approval_status
     FROM ojt_profiles
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      statusCode: 404,
      response: {
        success: false,
        message: "OJT profile not found.",
      },
    };
  }

  const profile = result.rows[0];
  const status = profile.approval_status;

  if (status !== "APPROVED") {
    return {
      allowed: false,
      statusCode: 403,
      response: {
        success: false,
        code: "OJT_NOT_APPROVED",
        approval_status: status,
        message:
          status === "REJECTED"
            ? "Your OJT profile was rejected. Please correct and resubmit your profile."
            : "Your OJT profile is pending approval. Attendance is locked until approved.",
      },
    };
  }

  return {
    allowed: true,
    profile,
  };
}

/* =========================================
   HELPER: CALCULATE GEOFENCE DISTANCE
========================================= */

function calculateDistance(
  studentLatitude,
  studentLongitude,
  geofence
) {
  const toRadians = (degrees) =>
    degrees * (Math.PI / 180);

  const earthRadius = 6371000;

  const centerLatitude = Number(geofence.latitude);
  const centerLongitude = Number(geofence.longitude);

  const lat1 = toRadians(centerLatitude);
  const lat2 = toRadians(studentLatitude);

  const deltaLat = toRadians(
    studentLatitude - centerLatitude
  );

  const deltaLon = toRadians(
    studentLongitude - centerLongitude
  );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(Math.max(0, 1 - a))
  );

  return earthRadius * c;
}

/* =========================================
   TIME IN
   POST /api/attendance/time-in
========================================= */

const timeIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const photo = req.file;

    // 1. Validate GPS coordinates
    const coordinates = validateCoordinates(
      latitude,
      longitude
    );

    if (!coordinates.valid) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required.",
      });
    }

    const lat = coordinates.latitude;
    const lon = coordinates.longitude;

    // 2. Check OJT approval BEFORE uploading photos
    const approval = await getApprovedOjtProfile(
      req.user.id
    );

    if (!approval.allowed) {
      return res
        .status(approval.statusCode)
        .json(approval.response);
    }

    const ojtProfileId = approval.profile.id;

    // 3. Require a photo proof
    if (!photo || !photo.buffer) {
      return res.status(400).json({
        success: false,
        message:
          "A photo proof is required for time-in.",
      });
    }

    // 4. Validate actual image signature
    const buffer = photo.buffer;

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
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
        message:
          "Please upload a valid JPEG, PNG, or WEBP image.",
      });
    }

    // 5. Find assigned geofence
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

    // 6. Calculate GPS distance
    const distanceMeters = calculateDistance(
      lat,
      lon,
      geofence
    );

    const insideGeofence =
      distanceMeters <= Number(geofence.radius_meters);

    if (!insideGeofence) {
      return res.status(403).json({
        success: false,
        message:
          "You are outside your approved OJT location.",
        inside_geofence: false,
        distance_meters: Number(
          distanceMeters.toFixed(2)
        ),
        allowed_radius_meters:
          geofence.radius_meters,
      });
    }

    // 7. Today's date in the Philippines
    const today = getPhilippineDate();

    // 8. Check if already timed in today
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
        message:
          "You have already timed in today.",
      });
    }

    // 9. Determine photo file extension
    const extensionByMimeType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension =
      extensionByMimeType[photo.mimetype];

    if (!extension) {
      return res.status(400).json({
        success: false,
        message:
          "Only JPEG, PNG, and WEBP photos are allowed.",
      });
    }

    const fileName =
      `${crypto.randomUUID()}.${extension}`;

    const photoPath =
      `${req.user.id}/${today}/${fileName}`;

    // 10. Upload photo to private Supabase bucket
    const { error: uploadError } =
      await supabase.storage
        .from("ojt-photo-proofs")
        .upload(photoPath, photo.buffer, {
          contentType: photo.mimetype,
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Photo upload error:",
        uploadError
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to upload photo proof. Please try again.",
      });
    }

    // 11. Save attendance record
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
          photoPath,
        ]
      );

      return res.status(201).json({
        success: true,
        message:
          "Time-in recorded successfully.",
        attendance: result.rows[0],
        geofence_check: {
          inside_geofence: true,
          distance_meters: Number(
            distanceMeters.toFixed(2)
          ),
          allowed_radius_meters:
            geofence.radius_meters,
        },
      });

    } catch (databaseError) {
      // Remove uploaded photo when DB insert fails
      const { error: cleanupError } =
        await supabase.storage
          .from("ojt-photo-proofs")
          .remove([photoPath]);

      if (cleanupError) {
        console.error(
          "Photo cleanup error:",
          cleanupError
        );
      }

      throw databaseError;
    }

  } catch (error) {
    console.error("Time-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================================
   TIME OUT
   POST /api/attendance/time-out
========================================= */

const timeOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // 1. Validate GPS coordinates
    const coordinates = validateCoordinates(
      latitude,
      longitude
    );

    if (!coordinates.valid) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required.",
      });
    }

    const lat = coordinates.latitude;
    const lon = coordinates.longitude;

    // 2. Check OJT approval
    const approval = await getApprovedOjtProfile(
      req.user.id
    );

    if (!approval.allowed) {
      return res
        .status(approval.statusCode)
        .json(approval.response);
    }

    const ojtProfileId = approval.profile.id;

    // 3. Find assigned geofence
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

    // 4. Calculate distance
    const distanceMeters = calculateDistance(
      lat,
      lon,
      geofence
    );

    const insideGeofence =
      distanceMeters <= Number(
        geofence.radius_meters
      );

    if (!insideGeofence) {
      return res.status(403).json({
        success: false,
        message:
          "You are outside your approved OJT location.",
        inside_geofence: false,
        distance_meters: Number(
          distanceMeters.toFixed(2)
        ),
        allowed_radius_meters:
          geofence.radius_meters,
      });
    }

    // 5. Today's Philippine date
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
        message:
          "No Time In record found for today.",
      });
    }

    const attendance = attendanceResult.rows[0];

    // 7. Check if already timed out
    if (attendance.time_out !== null) {
      return res.status(409).json({
        success: false,
        message:
          "You have already timed out today.",
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
         AND time_out IS NULL
       RETURNING *`,
      [
        lat,
        lon,
        attendance.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message:
          "You have already timed out today.",
      });
    }

    const updatedAttendance = result.rows[0];

    // 9. Calculate hours worked
    const timeInDate = new Date(
      updatedAttendance.time_in
    );

    const timeOutDate = new Date(
      updatedAttendance.time_out
    );

    const workedMilliseconds =
      timeOutDate.getTime() -
      timeInDate.getTime();

    const workedSeconds = Math.max(
      0,
      Math.floor(workedMilliseconds / 1000)
    );

    const hoursWorked = Math.floor(
      workedSeconds / 3600
    );

    const minutesWorked = Math.floor(
      (workedSeconds % 3600) / 60
    );

    const secondsWorked =
      workedSeconds % 60;

    // 10. Return attendance and working hours
    return res.json({
      success: true,
      message:
        "Time-out recorded successfully.",
      attendance: updatedAttendance,
      hours_worked: {
        hours: hoursWorked,
        minutes: minutesWorked,
        seconds: secondsWorked,
        display:
          `${hoursWorked}h ` +
          `${minutesWorked}m ` +
          `${secondsWorked}s`,
      },
      geofence_check: {
        inside_geofence: true,
        distance_meters: Number(
          distanceMeters.toFixed(2)
        ),
        allowed_radius_meters:
          geofence.radius_meters,
      },
    });

  } catch (error) {
    console.error("Time-out error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================================
   GET MY ATTENDANCE HISTORY
   GET /api/attendance/my-history
========================================= */

const getMyAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         id,
         TO_CHAR(
           attendance_date,
           'YYYY-MM-DD'
         ) AS attendance_date,
         time_in,
         time_out,
         latitude_in,
         longitude_in,
         latitude_out,
         longitude_out,
         time_in_status,
         time_out_status,
         CASE
           WHEN time_in IS NOT NULL
             AND time_out IS NOT NULL
           THEN EXTRACT(
             EPOCH FROM (time_out - time_in)
           )
           ELSE 0
         END AS seconds_worked
       FROM attendance
       WHERE user_id = $1
       ORDER BY attendance_date DESC`,
      [userId]
    );

    let totalSeconds = 0;

    const attendance = result.rows.map(
      (record) => {
        const secondsWorked =
          Number(record.seconds_worked) || 0;

        totalSeconds += secondsWorked;

        return {
          ...record,
          seconds_worked: secondsWorked,
          hours_worked: Number(
            (secondsWorked / 3600).toFixed(2)
          ),
        };
      }
    );

    return res.json({
      success: true,
      count: attendance.length,
      total_hours: Number(
        (totalSeconds / 3600).toFixed(2)
      ),
      attendance,
    });

  } catch (error) {
    console.error(
      "Get attendance history error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An error occurred while fetching attendance history.",
    });
  }
};

/* =========================================
   GET ATTENDANCE PHOTO PROOF
========================================= */

const getAttendancePhotoProof = async (
  req,
  res
) => {
  try {
    const { attendanceId } = req.params;

    // 1. Find attendance record and photo path
    const result = await pool.query(
      `SELECT
         id,
         user_id,
         photo_proof_path
       FROM attendance
       WHERE id = $1
       LIMIT 1`,
      [attendanceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Attendance record not found.",
      });
    }

    const attendance = result.rows[0];

    if (!attendance.photo_proof_path) {
      return res.status(404).json({
        success: false,
        message:
          "No photo proof is available for this attendance.",
      });
    }

    // 2. Check student ownership
    const isOwner =
      String(attendance.user_id) ===
      String(req.user.id);

    // 3. Check assigned supervisor
    let isAssignedSupervisor = false;

    if (
      !isOwner &&
      String(req.user.role).toUpperCase() ===
        "SUPERVISOR"
    ) {
      const supervisorCheck = await pool.query(
        `SELECT 1
         FROM weekly_reports
         WHERE user_id = $1
           AND supervisor_id = $2
         LIMIT 1`,
        [
          attendance.user_id,
          req.user.id,
        ]
      );

      isAssignedSupervisor =
        supervisorCheck.rows.length > 0;
    }

    if (
      !isOwner &&
      !isAssignedSupervisor
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this photo proof.",
      });
    }

    // 4. Generate temporary signed URL
    const { data, error } =
      await supabase.storage
        .from("ojt-photo-proofs")
        .createSignedUrl(
          attendance.photo_proof_path,
          300
        );

    if (error || !data?.signedUrl) {
      console.error(
        "Signed URL error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to retrieve the photo proof.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Photo proof retrieved successfully.",
      photo_url: data.signedUrl,
      expires_in_seconds: 300,
    });

  } catch (error) {
    console.error(
      "Get photo proof error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An error occurred while retrieving the photo proof.",
    });
  }
};

/* =========================================
   EXPORT CONTROLLERS
========================================= */

module.exports = {
  timeIn,
  timeOut,
  getMyAttendanceHistory,
  getAttendancePhotoProof,
};
