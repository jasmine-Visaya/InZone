
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
  const uploadedPaths = [];

  try {
    const approval = await getApprovedOjtProfile(req.user.id);

    if (!approval.allowed) {
      return res.status(approval.statusCode).json(approval.response);
    }

    const photos = req.files || [];
    const description = String(
      req.body?.accomplishment_text || ""
    ).trim();

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Daily accomplishment description is required.",
      });
    }

    if (description.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 5000 characters.",
      });
    }

    if (photos.length < 1 || photos.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Please upload 1 to 10 accomplishment photos.",
      });
    }

    for (const photo of photos) {
      const imageError = validateAccomplishmentImage(photo);

      if (imageError) {
        return res.status(400).json({
          success: false,
          message: imageError,
        });
      }
    }

    const today = getPhilippineDate();
    const attendanceId = req.params.attendanceId;

    const lookup = await pool.query(
      `SELECT id, user_id, time_in, time_out,
              accomplishment_photo_path,
              accomplishment_photo_paths
       FROM attendance
       WHERE id = $1
         AND user_id = $2
         AND attendance_date = $3
       LIMIT 1`,
      [attendanceId, req.user.id, today]
    );

    if (!lookup.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Today's attendance record not found.",
      });
    }

    const attendance = lookup.rows[0];

    if (!attendance.time_in || attendance.time_out) {
      return res.status(409).json({
        success: false,
        message:
          "You can submit a report only after Time In and before Time Out.",
      });
    }

    if (
      attendance.accomplishment_photo_path ||
      (Array.isArray(attendance.accomplishment_photo_paths) &&
        attendance.accomplishment_photo_paths.length > 0)
    ) {
      return res.status(409).json({
        success: false,
        message: "Daily accomplishment report already submitted.",
      });
    }

    const storage = supabase.storage.from("ojt-photo-proofs");

    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    for (const photo of photos) {
      const extension = extensions[photo.mimetype];

      const storagePath =
        `${req.user.id}/${today}/accomplishment/` +
        `${crypto.randomUUID()}.${extension}`;

      const { error } = await storage.upload(
        storagePath,
        photo.buffer,
        {
          contentType: photo.mimetype,
          upsert: false,
        }
      );

      if (error) {
        throw error;
      }

      uploadedPaths.push(storagePath);
    }

    const result = await pool.query(
      `UPDATE attendance
       SET accomplishment_photo_path = $1,
           accomplishment_photo_paths = $2::jsonb,
           accomplishment_text = $3,
           accomplishment_uploaded_at = NOW()
       WHERE id = $4
         AND user_id = $5
         AND attendance_date = $6
         AND time_in IS NOT NULL
         AND time_out IS NULL
         AND accomplishment_photo_path IS NULL
         AND accomplishment_photo_paths = '[]'::jsonb
       RETURNING id, accomplishment_uploaded_at`,
      [
        uploadedPaths[0],
        JSON.stringify(uploadedPaths),
        description,
        attendanceId,
        req.user.id,
        today,
      ]
    );

    if (!result.rows.length) {
      await storage.remove(uploadedPaths);

      return res.status(409).json({
        success: false,
        message:
          "Report could not be saved. Attendance may already be completed.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Daily accomplishment report submitted successfully.",
      attendance_id: result.rows[0].id,
      accomplishment_uploaded: true,
      accomplishment_uploaded_at:
        result.rows[0].accomplishment_uploaded_at,
      photo_count: uploadedPaths.length,
    });
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from("ojt-photo-proofs")
        .remove(uploadedPaths);

      if (cleanupError) {
        console.error("Photo cleanup error:", cleanupError);
      }
    }

    console.error("Daily accomplishment submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit daily accomplishment report.",
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

        accomplishment_photo_path,
        accomplishment_photo_paths,
        accomplishment_text,
        accomplishment_uploaded_at,

        (
          accomplishment_photo_path IS NOT NULL
        ) AS accomplishment_uploaded,

        COALESCE(
          review_status,
          'PENDING'
        ) AS review_status,

        supervisor_comment,
        reviewed_at,

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

    const attendance = result.rows.map((record) => {
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
    });

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
   GET MY DAILY ACCOMPLISHMENT PHOTOS
   GET /api/attendance/accomplishment-photos
========================================= */

const getMyAccomplishmentPhotos = async (req, res) => {
  try {
    const userId = req.user.id;

    const weekStart = String(req.query.week_start || "").trim();
    const weekEnd = String(req.query.week_end || "").trim();

    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!validDate(weekStart) || !validDate(weekEnd)) {
      return res.status(400).json({
        success: false,
        message: "Valid week_start and week_end dates are required.",
      });
    }

    if (weekStart > weekEnd) {
      return res.status(400).json({
        success: false,
        message: "Week start must not be after week end.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         TO_CHAR(attendance_date, 'YYYY-MM-DD')
           AS attendance_date,
         accomplishment_photo_path,
         accomplishment_photo_paths,
         accomplishment_text
       FROM attendance
       WHERE user_id = $1
         AND attendance_date BETWEEN $2::date AND $3::date
       ORDER BY attendance_date ASC`,
      [userId, weekStart, weekEnd]
    );

    const storage = supabase.storage.from("ojt-photo-proofs");

    const records = [];

    for (const attendance of result.rows) {
      const paths = Array.isArray(
        attendance.accomplishment_photo_paths
      )
        ? attendance.accomplishment_photo_paths.filter(
            (path) => typeof path === "string" && path.trim()
          )
        : [];

      // Support old records that only contain one photo.
      if (
        attendance.accomplishment_photo_path &&
        !paths.includes(attendance.accomplishment_photo_path)
      ) {
        paths.unshift(attendance.accomplishment_photo_path);
      }

      if (!paths.length) continue;

      const photos = [];

      for (const path of paths) {
        const { data, error } = await storage.createSignedUrl(
          path,
          300
        );

        if (error || !data?.signedUrl) {
          console.error("Photo signed URL error:", error);
          continue;
        }

        photos.push({
          path,
          photo_url: data.signedUrl,
        });
      }

      records.push({
        attendance_id: attendance.id,
        attendance_date: attendance.attendance_date,
        accomplishment_text: attendance.accomplishment_text,
        photos,
      });
    }

    return res.json({
      success: true,
      week_start: weekStart,
      week_end: weekEnd,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Fetch accomplishment photos error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve daily accomplishment photos.",
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
  getMyAccomplishmentPhotos,
};