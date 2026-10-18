const pool = require("../src/config/database");

const VALID_ROLES = new Set(["STUDENT", "SUPERVISOR", "ADMIN"]);

const VALID_DECISIONS = new Set(["APPROVED", "REJECTED"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Never return passwords or other secrets.
const PUBLIC_USER_COLUMNS =
  "id, first_name, last_name, email, role, status, created_at";

function isValidUserId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function sendError(res, error, fallback) {
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "That email address is already in use.",
    });
  }

  console.error(fallback, error);

  return res.status(500).json({
    success: false,
    message: fallback,
  });
}

// =====================================
// GET ALL USERS
// GET /api/admin/users
// =====================================
const getUsers = async (req, res) => {
  try {
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 120);

    const role = String(req.query.role || "")
      .trim()
      .toUpperCase();

    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();

    if (role && !VALID_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter.",
      });
    }

    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    const result = await pool.query(
      `SELECT ${PUBLIC_USER_COLUMNS}
       FROM users
       WHERE (
         $1::text = ''
         OR (
           COALESCE(first_name, '') ILIKE '%' || $1 || '%'
           OR COALESCE(last_name, '') ILIKE '%' || $1 || '%'
           OR COALESCE(email, '') ILIKE '%' || $1 || '%'
         )
       )
       AND ($2::text = '' OR UPPER(role) = $2)
       AND ($3::text = '' OR UPPER(status) = $3)
       ORDER BY
         LOWER(COALESCE(last_name, '')),
         LOWER(COALESCE(first_name, '')),
         id`,
      [search, role, status],
    );

    const users = result.rows;

    const summary = {
      total: users.length,

      students: users.filter((u) => String(u.role).toUpperCase() === "STUDENT")
        .length,

      supervisors: users.filter(
        (u) => String(u.role).toUpperCase() === "SUPERVISOR",
      ).length,

      admins: users.filter((u) => String(u.role).toUpperCase() === "ADMIN")
        .length,

      pending: users.filter((u) => String(u.status).toUpperCase() === "PENDING")
        .length,
    };

    return res.json({
      success: true,
      count: users.length,
      summary,
      users,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve users.");
  }
};

// =====================================
// GET SINGLE USER
// GET /api/admin/users/:userId
// =====================================
const getUserById = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT ${PUBLIC_USER_COLUMNS}
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve user.");
  }
};

// =====================================
// UPDATE USER DETAILS
// PATCH /api/admin/users/:userId
// =====================================
const updateUserDetails = async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  const { first_name, last_name, email } = req.body || {};

  if (
    [first_name, last_name, email].some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, and email are required.",
    });
  }

  const firstName = first_name.trim();
  const lastName = last_name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (
    firstName.length > 100 ||
    lastName.length > 100 ||
    cleanEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    return res.status(400).json({
      success: false,
      message: "Check name lengths and enter a valid email address.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET
         first_name = $1,
         last_name = $2,
         email = $3
       WHERE id = $4
       RETURNING ${PUBLIC_USER_COLUMNS}`,
      [firstName, lastName, cleanEmail, userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "User details updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error, "Unable to update user details.");
  }
};

// =====================================
// CHANGE USER ROLE
// PATCH /api/admin/users/:userId/role
// =====================================
const updateUserRole = async (req, res) => {
  const { userId } = req.params;

  const newRole = String(req.body?.role || "")
    .trim()
    .toUpperCase();

  if (!isValidUserId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  if (!VALID_ROLES.has(newRole)) {
    return res.status(400).json({
      success: false,
      message: "Role must be STUDENT, SUPERVISOR, or ADMIN.",
    });
  }

  // An Admin cannot change their own role.
  if (String(req.user.id).toLowerCase() === userId.toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: "You cannot change your own role.",
    });
  }

  const client = await pool.connect().catch(() => null);

  if (!client) {
    return res.status(500).json({
      success: false,
      message: "Database unavailable.",
    });
  }

  try {
    await client.query("BEGIN");

    // Serialize privileged role changes.
    await client.query("SELECT pg_advisory_xact_lock(47320116)");

    const current = await client.query(
      `SELECT id, role, status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );

    if (!current.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = current.rows[0];

    const oldRole = String(user.role).toUpperCase();

    const accountStatus = String(user.status).toUpperCase();

    // Only approved accounts can become Admin.
    if (newRole === "ADMIN" && accountStatus !== "APPROVED") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Approve the account before assigning the ADMIN role.",
      });
    }

    // Protect the last approved Admin account.
    if (
      oldRole === "ADMIN" &&
      newRole !== "ADMIN" &&
      accountStatus === "APPROVED"
    ) {
      const result = await client.query(
        `SELECT COUNT(*)::int AS remaining
         FROM users
         WHERE UPPER(role) = 'ADMIN'
           AND UPPER(status) = 'APPROVED'
           AND id <> $1`,
        [userId],
      );

      if (result.rows[0].remaining < 1) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Cannot demote the last approved Admin.",
        });
      }
    }

    const updated = await client.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING ${PUBLIC_USER_COLUMNS}`,
      [newRole, userId],
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "User role updated. The affected user must log in again.",
      user: updated.rows[0],
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Ignore rollback failure.
    }

    return sendError(res, error, "Unable to update user role.");
  } finally {
    client.release();
  }
};

// =====================================
// APPROVE / REJECT ACCOUNT
// PATCH /api/admin/users/:userId/status
// =====================================
const updateUserStatus = async (req, res) => {
  const { userId } = req.params;

  const newStatus = String(req.body?.status || "")
    .trim()
    .toUpperCase();

  if (!isValidUserId(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  if (!VALID_DECISIONS.has(newStatus)) {
    return res.status(400).json({
      success: false,
      message: "Status must be APPROVED or REJECTED.",
    });
  }

  // Prevent self-approval or self-rejection.
  if (String(req.user.id).toLowerCase() === userId.toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: "You cannot change your own account status.",
    });
  }

  try {
    // Only PENDING accounts can be approved/rejected.
    const result = await pool.query(
      `UPDATE users
       SET status = $1
       WHERE id = $2
         AND UPPER(status) = 'PENDING'
       RETURNING ${PUBLIC_USER_COLUMNS}`,
      [newStatus, userId],
    );

    if (!result.rows.length) {
      return res.status(409).json({
        success: false,
        message: "Pending user account not found or already reviewed.",
      });
    }

    return res.json({
      success: true,
      message: `User account ${newStatus.toLowerCase()} successfully.`,
      user: result.rows[0],
    });
  } catch (error) {
    return sendError(res, error, "Unable to update account status.");
  }
};

// =====================================
// EXPORT CONTROLLERS
// =====================================
module.exports = {
  getUsers,
  getUserById,
  updateUserDetails,
  updateUserRole,
  updateUserStatus,
};
