
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const requireSupervisor = require("../middleware/supervisorMiddleware");

const {
    getPendingReports,
    getMyStudentsReports,
    reviewReport
} = require("../controllers/supervisorReportController");

// All routes below require a valid supervisor JWT
router.use(authenticateToken, requireSupervisor);

// GET /api/supervisor/reports?status=PENDING|APPROVED|REJECTED
router.get("/", getMyStudentsReports);

// GET /api/supervisor/reports/pending
router.get("/pending", getPendingReports);

// PATCH /api/supervisor/reports/:reportId/review
router.patch("/:reportId/review", reviewReport);

module.exports = router;
