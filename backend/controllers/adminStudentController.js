
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

const updateStudentAccountStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.body;

    // Only allow these two decisions
    const newStatus = String(status || "").toUpperCase();

    if (!["APPROVED", "REJECTED"].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED."
      });
    }

    // Make sure the ID is a valid UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID."
      });
    }

    // Only update pending student accounts
    const result = await pool.query(
      `UPDATE users
       SET status = $1
       WHERE id = $2
         AND UPPER(role) = 'STUDENT'
         AND UPPER(status) = 'PENDING'
       RETURNING id, first_name, last_name, email, role, status`,
      [newStatus, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending student account not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Student account ${newStatus.toLowerCase()} successfully.`,
      student: result.rows[0]
    });
  } catch (error) {
    console.error("Update student account status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update student account."
    });
  }
};


/* =====================================
   UPDATE STUDENT DETAILS
   PATCH /api/admin/students/:studentId
===================================== */

const updateStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { first_name, last_name, email } = req.body;

    // Validate student UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    // Require all three fields
    if (
      typeof first_name !== "string" ||
      typeof last_name !== "string" ||
      typeof email !== "string" ||
      !first_name.trim() ||
      !last_name.trim() ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and email are required.",
      });
    }

    const cleanFirstName = first_name.trim();
    const cleanLastName = last_name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // Update only student accounts
    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3
       WHERE id = $4
         AND UPPER(role) = 'STUDENT'
       RETURNING id, first_name, last_name, email, role, status`,
      [cleanFirstName, cleanLastName, cleanEmail, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student details updated successfully.",
      student: result.rows[0],
    });
  } catch (error) {
    // PostgreSQL unique-constraint violation
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "That email address is already in use.",
      });
    }

    console.error("Update student details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update student details.",
    });
  }
};


module.exports = {
  getStudents,
  updateStudentAccountStatus,
  updateStudentDetails
};
