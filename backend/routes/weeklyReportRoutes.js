
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const {
  submitWeeklyReport,
  getMyReports,
  getWeekPreview,
} = require("../controllers/weeklyReportController");

router.post("/submit", authenticateToken, submitWeeklyReport);
router.get("/my-reports", authenticateToken, getMyReports);
router.get("/preview", authenticateToken, getWeekPreview);

module.exports = router;