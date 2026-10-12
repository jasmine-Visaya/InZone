
const pool = require("../src/config/database");

/* =====================================
   LIST REGISTERED STUDENTS
   GET /api/admin/students
===================================== */

const getStudents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,

        p.id AS ojt_profile_id,
        p.company_name,
        p.company_address,
        p.required_hours,
        p.start_date,
        p.end_date,
        p.approval_status,

        g.latitude,
        g.longitude,
        g.radius_meters

      FROM users u

      LEFT JOIN LATERAL (
        SELECT
          id,
          company_name,
          company_address,
          required_hours,
          start_date,
          end_date,
          approval_status
        FROM ojt_profiles
        WHERE user_id = u.id
        ORDER BY id DESC
        LIMIT 1
      ) p ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          latitude,
          longitude,
          radius_meters
        FROM geofences
        WHERE ojt_profile_id = p.id
        ORDER BY id DESC
        LIMIT 1
      ) g ON TRUE

      WHERE UPPER(u.role) = 'STUDENT'

      ORDER BY
        LOWER(COALESCE(u.last_name, '')),
        LOWER(COALESCE(u.first_name, '')),
        u.id
    `);

    const students = result.rows.map((row) => ({
      ...row,
      ojt_status:
        row.approval_status || "NOT_SUBMITTED",
    }));

    const summary = {
      total: students.length,
      approved: students.filter(
        (s) => s.ojt_status === "APPROVED"
      ).length,
      pending: students.filter(
        (s) => s.ojt_status === "PENDING"
      ).length,
      rejected: students.filter(
        (s) => s.ojt_status === "REJECTED"
      ).length,
      not_submitted: students.filter(
        (s) => s.ojt_status === "NOT_SUBMITTED"
      ).length,
    };

    return res.status(200).json({
      success: true,
      count: students.length,
      summary,
      students,
    });
  } catch (error) {
    console.error("Get admin students error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve student list.",
    });
  }
};

module.exports = {
  getStudents,
};
