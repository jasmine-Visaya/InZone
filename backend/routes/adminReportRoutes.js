const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const {
  getAllWeeklyReports,
  getOverview,
  getDailyReports,
  getDailyPhoto,
} = require("../controllers/adminReportController");

router.use(authenticateToken);
router.use((req, res, next) => {
  if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
    return res
      .status(403)
      .json({ success: false, message: "Admin access only." });
  }
  next();
});

router.get("/overview", getOverview);
router.get("/daily", getDailyReports);
router.get("/daily/:attendanceId/photo/:kind", getDailyPhoto);
router.get("/", getAllWeeklyReports);
module.exports = router;
