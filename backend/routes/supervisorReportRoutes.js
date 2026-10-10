
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const requireSupervisor = require("../middleware/supervisorMiddleware");

const {
    getPendingReports,
    reviewReport
} = require("../controllers/supervisorReportController");

// All routes below require a valid supervisor JWT
router.get(
    "/pending",
    authenticateToken,
    requireSupervisor,
    getPendingReports
);

router.patch(
    "/:reportId/review",
    authenticateToken,
    requireSupervisor,
    reviewReport
);

module.exports = router;