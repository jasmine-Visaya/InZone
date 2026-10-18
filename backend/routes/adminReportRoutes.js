
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { getAllWeeklyReports } = require("../controllers/adminReportController");

// All routes require authentication.
router.use(authenticateToken);

// Admin-only authorization.
router.use((req, res, next) => {
  const role = String(req.user?.role || "").toUpperCase();

  if (role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Admin access only.",
    });
  }

  next();
});

// GET /api/admin/reports
router.get("/", getAllWeeklyReports);

module.exports = router;
