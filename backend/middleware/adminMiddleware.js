const pool = require("../src/config/database");

// Use this AFTER authenticateToken.
const requireAdmin = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT role, status
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    const user = result.rows[0];

    // Account must be approved.
    if (String(user.status || "").toUpperCase() !== "APPROVED") {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    // Only ADMIN role is allowed.
    if (String(user.role || "").toUpperCase() !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    return next();
  } catch (error) {
    console.error("Admin middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify Admin permissions.",
    });
  }
};

module.exports = requireAdmin;
