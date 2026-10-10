
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const { submitWeeklyReport, getMyReports } = require("../controllers/weeklyReportController");

router.post("/submit", authenticateToken, submitWeeklyReport);
router.get("/my-reports", authenticateToken, getMyReports);

module.exports = router;