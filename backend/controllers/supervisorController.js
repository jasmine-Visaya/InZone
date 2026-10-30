const pool = require("../src/config/database");
const { getPhilippineDate } = require("../utils/dateTime");

// =====================================
// HELPERS
// =====================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function serverError(res, error, label, message) {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message });
}

// Attendance status shown to the supervisor:
//   COMPLETE    -> timed in and timed out
//   ON_DUTY     -> timed in today, not yet timed out
//   NO_TIME_OUT -> timed in on a past day but never timed out
const ATTENDANCE_STATUS_SQL = `
  CASE
    WHEN a.time_out IS NOT NULL THEN 'COMPLETE'
    WHEN a.attendance_date = $2::date THEN 'ON_DUTY'
    ELSE 'NO_TIME_OUT'
  END
`;

const SECONDS_WORKED_SQL = `
  CASE
    WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (a.time_out - a.time_in))
    ELSE 0
  END
`;

// One row per student assigned to the supervisor ($1).
// $2 is today's date in the Philippines.
const STUDENT_SUMMARY_SQL = `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.status AS account_status,

    p.id AS ojt_profile_id,
    p.company_name,
    p.company_address,
    p.required_hours,
    p.start_date::text AS start_date,
    p.end_date::text AS end_date,
    p.approval_status,

    g.name AS geofence_name,
    g.latitude,
    g.longitude,
    g.radius_meters,

    COALESCE(att.total_seconds, 0) AS total_seconds,
    COALESCE(att.days_present, 0) AS days_present,
    att.last_attendance_date::text AS last_attendance_date,

    today.time_in AS today_time_in,
    today.time_out AS today_time_out,

    COALESCE(rep.pending_reports, 0) AS pending_reports

  FROM ojt_profiles p
  JOIN users u ON u.id = p.user_id

  LEFT JOIN LATERAL (
    SELECT name, latitude, longitude, radius_meters
    FROM geofences
    WHERE ojt_profile_id = p.id
    ORDER BY id DESC
    LIMIT 1
  ) g ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      SUM(${SECONDS_WORKED_SQL}) AS total_seconds,
      COUNT(DISTINCT a.attendance_date) AS days_present,
      MAX(a.attendance_date) AS last_attendance_date
    FROM attendance a
    WHERE a.user_id = u.id
  ) att ON TRUE

  LEFT JOIN LATERAL (
    SELECT time_in, time_out
    FROM attendance
    WHERE user_id = u.id
      AND attendance_date = $2::date
    ORDER BY time_in DESC
    LIMIT 1
  ) today ON TRUE

  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS pending_reports
    FROM weekly_reports
    WHERE user_id = u.id
      AND status = 'PENDING'
  ) rep ON TRUE

  WHERE p.supervisor_id = $1
`;

function mapStudent(row) {
  const totalSeconds = toNumber(row.total_seconds);
  const requiredHours = toNumber(row.required_hours);
  const hoursRendered = Number((totalSeconds / 3600).toFixed(2));

  let todayStatus = "NO_RECORD";
  if (row.today_time_in && row.today_time_out) todayStatus = "COMPLETE";
  else if (row.today_time_in) todayStatus = "ON_DUTY";

  const { total_seconds, ...rest } = row;

  return {
    ...rest,
    approval_status: String(row.approval_status || "PENDING").toUpperCase(),
    account_status: String(row.account_status || "").toUpperCase(),
    required_hours: requiredHours,
    hours_rendered: hoursRendered,
    remaining_hours: Math.max(0, Number((requiredHours - hoursRendered).toFixed(2))),
    progress_percent: requiredHours > 0
      ? Math.min(100, Math.round((hoursRendered / requiredHours) * 100))
      : 0,
    days_present: toNumber(row.days_present),
    pending_reports: toNumber(row.pending_reports),
    today_status: todayStatus,
  };
}

// =====================================
// DASHBOARD SUMMARY
// GET /api/supervisor/dashboard
// =====================================
const getDashboard = async (req, res) => {
  try {
    const today = getPhilippineDate();

    const result = await pool.query(
      `WITH my_students AS (
         SELECT user_id
         FROM ojt_profiles
         WHERE supervisor_id = $1
       )
       SELECT
         (SELECT COUNT(*) FROM my_students) AS assigned_students,

         (SELECT COUNT(DISTINCT a.user_id)
            FROM attendance a
            JOIN my_students s ON s.user_id = a.user_id
           WHERE a.attendance_date = $2::date) AS timed_in_today,

         (SELECT COUNT(DISTINCT a.user_id)
            FROM attendance a
            JOIN my_students s ON s.user_id = a.user_id
           WHERE a.attendance_date = $2::date
             AND a.time_in IS NOT NULL
             AND a.time_out IS NULL) AS on_duty_now,

         (SELECT COUNT(*)
            FROM attendance a
            JOIN my_students s ON s.user_id = a.user_id
           WHERE a.attendance_date < $2::date
             AND a.time_in IS NOT NULL
             AND a.time_out IS NULL) AS missing_time_out,

         (SELECT COUNT(*)
            FROM weekly_reports wr
            JOIN my_students s ON s.user_id = wr.user_id
           WHERE wr.status = 'PENDING') AS pending_reports,

         (SELECT COUNT(*)
            FROM weekly_reports wr
           WHERE wr.supervisor_id = $1
             AND wr.status <> 'PENDING') AS reviewed_by_me`,
      [req.user.id, today]
    );

    const row = result.rows[0] || {};

    return res.json({
      success: true,
      date: today,
      summary: {
        assigned_students: toNumber(row.assigned_students),
        timed_in_today: toNumber(row.timed_in_today),
        on_duty_now: toNumber(row.on_duty_now),
        missing_time_out: toNumber(row.missing_time_out),
        pending_reports: toNumber(row.pending_reports),
        reviewed_by_me: toNumber(row.reviewed_by_me),
      },
    });
  } catch (error) {
    return serverError(res, error, "Supervisor dashboard error",
      "Unable to load the dashboard summary.");
  }
};

// =====================================
// ASSIGNED STUDENTS
// GET /api/supervisor/students
// =====================================
const getMyStudents = async (req, res) => {
  try {
    const today = getPhilippineDate();

    const result = await pool.query(
      `${STUDENT_SUMMARY_SQL}
       ORDER BY
         LOWER(COALESCE(u.last_name, '')),
         LOWER(COALESCE(u.first_name, ''))`,
      [req.user.id, today]
    );

    return res.json({
      success: true,
      date: today,
      count: result.rows.length,
      students: result.rows.map(mapStudent),
    });
  } catch (error) {
    return serverError(res, error, "Supervisor students error",
      "Unable to load your students.");
  }
};

// =====================================
// ONE ASSIGNED STUDENT + ATTENDANCE + REPORTS
// GET /api/supervisor/students/:studentId
// =====================================
const getStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!UUID_PATTERN.test(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const today = getPhilippineDate();

    const studentResult = await pool.query(
      `${STUDENT_SUMMARY_SQL}
         AND u.id = $3`,
      [req.user.id, today, studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not assigned to you.",
      });
    }

    const attendanceResult = await pool.query(
      `SELECT
         a.id,
         a.attendance_date::text AS attendance_date,
         a.time_in,
         a.time_out,
         a.time_in_status,
         a.time_out_status,
         (a.photo_proof_path IS NOT NULL) AS has_photo_proof,
         ${SECONDS_WORKED_SQL} AS seconds_worked,
         ${ATTENDANCE_STATUS_SQL} AS status
       FROM attendance a
       WHERE a.user_id = $1
       ORDER BY a.attendance_date DESC, a.time_in DESC`,
      [studentId, today]
    );

    const reportsResult = await pool.query(
      `SELECT
         id,
         week_start::text AS week_start,
         week_end::text AS week_end,
         report,
         status,
         supervisor_comment,
         supervisor_id,
         reviewed_at,
         created_at
       FROM weekly_reports
       WHERE user_id = $1
       ORDER BY week_start DESC, created_at DESC`,
      [studentId]
    );

    return res.json({
      success: true,
      date: today,
      student: mapStudent(studentResult.rows[0]),
      attendance: attendanceResult.rows.map((record) => {
        const { seconds_worked, ...rest } = record;
        return {
          ...rest,
          hours_worked: Number((toNumber(seconds_worked) / 3600).toFixed(2)),
        };
      }),
      reports: reportsResult.rows,
    });
  } catch (error) {
    return serverError(res, error, "Supervisor student details error",
      "Unable to load this student's details.");
  }
};

// =====================================
// DAILY ATTENDANCE OF ASSIGNED STUDENTS
// GET /api/supervisor/attendance?date=YYYY-MM-DD
// =====================================
const getAttendanceByDate = async (req, res) => {
  try {
    const today = getPhilippineDate();
    const date = String(req.query.date || today).trim();

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format.",
      });
    }

    // $2 here is "today" so ON_DUTY / NO_TIME_OUT are computed correctly,
    // $3 is the day being viewed.
    const result = await pool.query(
      `SELECT
         u.id AS student_id,
         u.first_name,
         u.last_name,
         u.email,
         p.company_name,
         p.approval_status,
         a.id AS attendance_id,
         a.time_in,
         a.time_out,
         a.time_in_status,
         a.time_out_status,
         (a.photo_proof_path IS NOT NULL) AS has_photo_proof,
         ${SECONDS_WORKED_SQL} AS seconds_worked,
         CASE
           WHEN a.id IS NULL THEN 'NO_RECORD'
           ELSE ${ATTENDANCE_STATUS_SQL}
         END AS status
       FROM ojt_profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT *
         FROM attendance
         WHERE user_id = u.id
           AND attendance_date = $3::date
         ORDER BY time_in DESC
         LIMIT 1
       ) a ON TRUE
       WHERE p.supervisor_id = $1
       ORDER BY
         CASE WHEN a.id IS NULL THEN 1 ELSE 0 END,
         a.time_in ASC,
         LOWER(COALESCE(u.last_name, '')),
         LOWER(COALESCE(u.first_name, ''))`,
      [req.user.id, today, date]
    );

    const records = result.rows.map((record) => {
      const { seconds_worked, ...rest } = record;
      return {
        ...rest,
        approval_status: String(record.approval_status || "PENDING").toUpperCase(),
        hours_worked: Number((toNumber(seconds_worked) / 3600).toFixed(2)),
      };
    });

    const count = (status) => records.filter((r) => r.status === status).length;

    return res.json({
      success: true,
      date,
      today,
      summary: {
        total: records.length,
        complete: count("COMPLETE"),
        on_duty: count("ON_DUTY"),
        no_time_out: count("NO_TIME_OUT"),
        no_record: count("NO_RECORD"),
      },
      records,
    });
  } catch (error) {
    return serverError(res, error, "Supervisor attendance error",
      "Unable to load attendance records.");
  }
};

// =====================================
// SUPERVISOR PROFILE
// GET /api/supervisor/profile
// =====================================
const getProfile = async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, first_name, last_name, email, role, status, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const companiesResult = await pool.query(
      `SELECT company_name, COUNT(*) AS students
       FROM ojt_profiles
       WHERE supervisor_id = $1
       GROUP BY company_name
       ORDER BY company_name`,
      [req.user.id]
    );

    const companies = companiesResult.rows.map((row) => ({
      company_name: row.company_name,
      students: toNumber(row.students),
    }));

    return res.json({
      success: true,
      profile: {
        ...userResult.rows[0],
        assigned_students: companies.reduce((sum, c) => sum + c.students, 0),
        companies,
      },
    });
  } catch (error) {
    return serverError(res, error, "Supervisor profile error",
      "Unable to load your profile.");
  }
};

module.exports = {
  getDashboard,
  getMyStudents,
  getStudentDetails,
  getAttendanceByDate,
  getProfile,
};
