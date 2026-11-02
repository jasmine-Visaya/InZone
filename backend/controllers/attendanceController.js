
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
   HELPER: VALIDATE IMAGE
========================================= */

function validateAccomplishmentImage(photo) {
  if (!photo?.buffer || !photo.buffer.length) {
    return "A report photo is required.";
  }

  if (photo.buffer.length > 5 * 1024 * 1024) {
    return "Report photo must not exceed 5 MB.";
  }

  const bytes = photo.buffer;

  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  const png =
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ])
    );

  const webp =
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";

  const matches =
    (photo.mimetype === "image/jpeg" && jpeg) ||
    (photo.mimetype === "image/png" && png) ||
    (photo.mimetype === "image/webp" && webp);

  return matches
    ? null
    : "Only valid JPEG, PNG, or WEBP report photos are allowed.";
}

/* =========================================
   TIME IN
   POST /api/attendance/time-in
========================================= */

const timeIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const photo = req.file;

    // Validate GPS coordinates
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

    // Check OJT approval
    const approval = await getApprovedOjtProfile(
      req.user.id
    );

    if (!approval.allowed) {
      return res
        .status(approval.statusCode)
        .json(approval.response);
    }

    const ojtProfileId = approval.profile.id;

    // Require time-in photo
    if (!photo || !photo.buffer) {
      return res.status(400).json({
        success: false,
        message:
          "A photo proof is required for time-in.",
      });
    }

    // Validate image signature
    const imageError = validateAccomplishmentImage(photo);

    if (imageError) {
      return res.status(400).json({
        success: false,
        message: imageError,
      });
    }

    // Find assigned geofence
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

    // Calculate GPS distance
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

    // Philippine date
    const today = getPhilippineDate();

    // Check duplicate time-in
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

    // Generate unique storage filename
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = extensions[photo.mimetype];

    const fileName =
      `${crypto.randomUUID()}.${extension}`;

    const photoPath =
      `${req.user.id}/${today}/${fileName}`;

    // Upload to private Supabase Storage
    const storage = supabase.storage.from(
      "ojt-photo-proofs"
    );

    const { error: uploadError } =
      await storage.upload(
        photoPath,
        photo.buffer,
        {
          contentType: photo.mimetype,
          upsert: false,
        }
      );

    if (uploadError) {
      console.error("Photo upload error:", uploadError);

      return res.status(500).json({
        success: false,
        message:
          "Failed to upload photo proof. Please try again.",
      });
    }

    // Save attendance
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
         (
           $1, $2, $3, NOW(),
           $4, $5, 'VALID', $6
         )
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
      // Clean up uploaded photo if database fails
      const { error: cleanupError } =
        await storage.remove([photoPath]);

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
   UPLOAD DAILY ACCOMPLISHMENT REPORT
   POST /api/attendance/accomplishment/:attendanceId
========================================= */

const uploadAccomplishmentReport = async (req, res) => {
  try {
    // Check OJT approval
    const approval = await getApprovedOjtProfile(
      req.user.id
    );

    if (!approval.allowed) {
      return res
        .status(approval.statusCode)
        .json(approval.response);
    }

    // Validate uploaded report image
    const imageError = validateAccomplishmentImage(
      req.file
    );

    if (imageError) {
      return res.status(400).json({
        success: false,
        message: imageError,
      });
    }

    const today = getPhilippineDate();
    const attendanceId = req.params.attendanceId;

    // Find today's attendance owned by student
    const lookup = await pool.query(
      `SELECT
         id,
         user_id,
         time_in,
         time_out,
         accomplishment_photo_path
       FROM attendance
       WHERE id = $1
         AND user_id = $2
         AND attendance_date = $3
       LIMIT 1`,
      [
        attendanceId,
        req.user.id,
        today,
      ]
    );

    if (!lookup.rows.length) {
      return res.status(404).json({
        success: false,
        message:
          "Today's attendance record not found.",
      });
    }

    const attendance = lookup.rows[0];

    // Must have Time In but not Time Out
    if (!attendance.time_in || attendance.time_out) {
      return res.status(409).json({
        success: false,
        message:
          "You can upload a report only after Time In and before Time Out.",
      });
    }

    // Do not accept duplicate reports
    if (attendance.accomplishment_photo_path) {
      return res.status(409).json({
        success: false,
        message:
          "Daily accomplishment report already uploaded.",
      });
    }

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const fileName =
      `${crypto.randomUUID()}.${extensions[req.file.mimetype]}`;

    const storagePath =
      `${req.user.id}/${today}/accomplishment/${fileName}`;

    // Upload report to private Supabase bucket
    const storage = supabase.storage.from(
      "ojt-photo-proofs"
    );

    const { error: storageError } =
      await storage.upload(
        storagePath,
        req.file.buffer,
        {
          contentType: req.file.mimetype,
          upsert: false,
        }
      );

    if (storageError) {
      console.error(
        "Accomplishment upload error:",
        storageError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to store report photo.",
      });
    }

    try {
      // Save report path only for active attendance
      const saved = await pool.query(
        `UPDATE attendance
         SET
           accomplishment_photo_path = $1,
           accomplishment_uploaded_at = NOW()
         WHERE id = $2
           AND user_id = $3
           AND attendance_date = $4
           AND time_in IS NOT NULL
           AND time_out IS NULL
           AND accomplishment_photo_path IS NULL
         RETURNING
           id,
           accomplishment_uploaded_at`,
        [
          storagePath,
          attendanceId,
          req.user.id,
          today,
        ]
      );

      if (!saved.rows.length) {
        const cleanup = await storage.remove([
          storagePath,
        ]);

        if (cleanup.error) {
          console.error(
            "Accomplishment cleanup failed:",
            cleanup.error
          );
        }

        return res.status(409).json({
          success: false,
          message:
            "Report could not be saved; attendance may already be completed.",
        });
      }

      return res.status(201).json({
        success: true,
        message:
          "Daily accomplishment report uploaded successfully.",
        attendance_id: saved.rows[0].id,
        accomplishment_uploaded: true,
        accomplishment_uploaded_at:
          saved.rows[0].accomplishment_uploaded_at,
      });

    } catch (dbError) {
      // Delete uploaded image if database update fails
      const cleanup = await storage.remove([
        storagePath,
      ]);

      if (cleanup.error) {
        console.error(
          "Accomplishment cleanup failed:",
          cleanup.error
        );
      }

      throw dbError;
    }

  } catch (error) {
    console.error(
      "Submit accomplishment report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

/* =========================================
   GET ACCOMPLISHMENT REPORT PHOTO
   GET /api/attendance/accomplishment/:attendanceId
========================================= */

const getAccomplishmentPhoto = async (req, res) => {
  try {
    const lookup = await pool.query(
      `SELECT
         id,
         user_id,
         accomplishment_photo_path
       FROM attendance
       WHERE id = $1
       LIMIT 1`,
      [req.params.attendanceId]
    );

    if (
      !lookup.rows.length ||
      !lookup.rows[0].accomplishment_photo_path
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Accomplishment report not found.",
      });
    }

    const attendance = lookup.rows[0];

    // Student may view their own report
    const isOwner =
      String(attendance.user_id) ===
      String(req.user.id);

    let isSupervisor = false;

    // Assigned supervisor may also view the report
    if (
      !isOwner &&
      String(req.user.role).toUpperCase() ===
        "SUPERVISOR"
    ) {
      const linked = await pool.query(
        `SELECT 1
         FROM ojt_profiles
         WHERE user_id = $1
           AND supervisor_id = $2
         LIMIT 1`,
        [
          attendance.user_id,
          req.user.id,
        ]
      );

      isSupervisor = linked.rows.length > 0;
    }

    if (!isOwner && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to view this report.",
      });
    }

    // Create temporary signed image URL
    const { data, error } =
      await supabase.storage
        .from("ojt-photo-proofs")
        .createSignedUrl(
          attendance.accomplishment_photo_path,
          300
        );

    if (error || !data?.signedUrl) {
      console.error(
        "Accomplishment signed URL error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to retrieve report photo.",
      });
    }

    return res.json({
      success: true,
      photo_url: data.signedUrl,
      expires_in_seconds: 300,
    });

  } catch (error) {
    console.error(
      "Get accomplishment report error:",
      error
    );

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

    // Validate GPS coordinates
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

    // Check OJT approval
    const approval = await getApprovedOjtProfile(
      req.user.id
    );

    if (!approval.allowed) {
      return res
        .status(approval.statusCode)
        .json(approval.response);
    }

    const ojtProfileId = approval.profile.id;

    // Find assigned geofence
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

    // Calculate distance
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

    const today = getPhilippineDate();

    // Find today's attendance
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

    // Prevent duplicate Time Out
    if (attendance.time_out !== null) {
      return res.status(409).json({
        success: false,
        message:
          "You have already timed out today.",
      });
    }

    // ACCOMPLISHMENT REPORT REQUIRED
    if (!attendance.accomplishment_photo_path) {
      return res.status(400).json({
        success: false,
        code: "ACCOMPLISHMENT_REQUIRED",
        message:
          "Upload your daily accomplishment report before Time Out.",
      });
    }

    // Record Time Out
    // Recheck accomplishment condition in SQL
    const result = await pool.query(
      `UPDATE attendance
       SET
         time_out = NOW(),
         latitude_out = $1,
         longitude_out = $2,
         time_out_status = 'VALID'
       WHERE id = $3
         AND user_id = $4
         AND attendance_date = $5
         AND time_out IS NULL
         AND accomplishment_photo_path IS NOT NULL
       RETURNING *`,
      [
        lat,
        lon,
        attendance.id,
        req.user.id,
        today,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message:
          "Attendance has already been completed or updated.",
      });
    }

    const updatedAttendance = result.rows[0];

    // Calculate working hours
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
         (
           accomplishment_photo_path IS NOT NULL
         ) AS accomplishment_uploaded,
         accomplishment_uploaded_at,
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
   GET TIME-IN PHOTO PROOF
   GET /api/attendance/photo-proof/:attendanceId
========================================= */

const getAttendancePhotoProof = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    // Find attendance record
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

    // Check ownership
    const isOwner =
      String(attendance.user_id) ===
      String(req.user.id);

    let isAssignedSupervisor = false;

    if (
      !isOwner &&
      String(req.user.role).toUpperCase() ===
        "SUPERVISOR"
    ) {
      const supervisorCheck = await pool.query(
        `SELECT 1
         FROM ojt_profiles
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

    if (!isOwner && !isAssignedSupervisor) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this photo proof.",
      });
    }

    // Generate signed URL
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
   EXPORT ALL CONTROLLERS
========================================= */

module.exports = {
  timeIn,
  timeOut,
  getMyAttendanceHistory,
  getAttendancePhotoProof,
  uploadAccomplishmentReport,
  getAccomplishmentPhoto,
};
