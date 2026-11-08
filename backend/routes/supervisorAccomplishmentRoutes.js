const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const {
  getSupervisorAccomplishments,
  reviewSupervisorAccomplishment,
} = require("../controllers/supervisorAccomplishmentController");

const router = express.Router();

// =====================================
// GET DAILY ACCOMPLISHMENT REPORTS
// =====================================
router.get(
  "/",
  authenticateToken,
  getSupervisorAccomplishments
);

// =====================================
// APPROVE / REJECT DAILY REPORT
// =====================================
router.patch(
  "/:attendanceId/review",
  authenticateToken,
  reviewSupervisorAccomplishment
);

module.exports = router;