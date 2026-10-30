const pool = require("../src/config/database");

// =====================================
// VALIDATE STUDENT UUID
// =====================================
const isValidUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
};

// =====================================
// LIST REGISTERED STUDENTS
// GET /api/admin/students
// =====================================
const getStudents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.status AS account_status,

        p.id AS ojt_profile_id,
        p.company_name,
        p.company_address,
        p.required_hours,
        p.start_date,
        p.end_date,
        p.approval_status,
        p.supervisor_id,
        sup.first_name AS supervisor_first_name,
        sup.last_name AS supervisor_last_name,
        sup.email AS supervisor_email,


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
          approval_status,
          supervisor_id
        FROM ojt_profiles
        WHERE user_id = u.id
        ORDER BY id DESC
        LIMIT 1
      ) p ON TRUE
 
      LEFT JOIN users sup ON sup.id = p.supervisor_id

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

      account_status: String(row.account_status || "PENDING").toUpperCase(),

      ojt_status: String(row.approval_status || "NOT_SUBMITTED").toUpperCase(),
    }));

    // OJT Profile Summary
    const summary = {
      total: students.length,
      approved: students.filter((s) => s.ojt_status === "APPROVED").length,
      pending: students.filter((s) => s.ojt_status === "PENDING").length,
      rejected: students.filter((s) => s.ojt_status === "REJECTED").length,
      not_submitted: students.filter((s) => s.ojt_status === "NOT_SUBMITTED")
        .length,
    };

    // Student Account Summary
    const account_summary = {
      total: students.length,
      approved: students.filter((s) => s.account_status === "APPROVED").length,
      pending: students.filter((s) => s.account_status === "PENDING").length,
      rejected: students.filter((s) => s.account_status === "REJECTED").length,
    };

    return res.status(200).json({
      success: true,
      count: students.length,
      summary,
      account_summary,
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

// =====================================
// APPROVE / REJECT STUDENT ACCOUNT
// PATCH /api/admin/students/:studentId/account-status
// =====================================
const updateStudentAccountStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.body;

    const newStatus = String(status || "").toUpperCase();

    // Validate status
    if (!["APPROVED", "REJECTED"].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED or REJECTED.",
      });
    }

    // Validate UUID
    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    // Only pending student accounts can be reviewed
    const result = await pool.query(
      `UPDATE users
       SET status = $1
       WHERE id = $2
         AND UPPER(role) = 'STUDENT'
         AND UPPER(status) = 'PENDING'
       RETURNING
         id,
         first_name,
         last_name,
         email,
         role,
         status`,
      [newStatus, studentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending student account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Student account ${newStatus.toLowerCase()} successfully.`,
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Update student account status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update student account.",
    });
  }
};

// =====================================
// UPDATE STUDENT DETAILS
// PATCH /api/admin/students/:studentId
// =====================================
const updateStudentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { first_name, last_name, email } = req.body;

    // Validate UUID
    if (!isValidUUID(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    // Validate required fields
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

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // Update student identity
    const result = await pool.query(
      `UPDATE users
       SET
         first_name = $1,
         last_name = $2,
         email = $3
       WHERE id = $4
         AND UPPER(role) = 'STUDENT'
       RETURNING
         id,
         first_name,
         last_name,
         email,
         role,
         status`,
      [cleanFirstName, cleanLastName, cleanEmail, studentId],
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
  updateStudentDetails,
};
