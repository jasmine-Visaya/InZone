
const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");

const {
  getPendingProfiles,
  getProfileForReview,
  reviewProfile,
  assignSupervisor,
} = require("../controllers/ojtApprovalController");

const router = express.Router();

// Authentication is required for all routes.
router.use(authenticateToken);

router.get("/pending", getPendingProfiles);

router.get("/:profileId", getProfileForReview);

router.patch("/:profileId", reviewProfile);

// Assign / change / remove the student's company supervisor
router.patch("/:profileId/supervisor", assignSupervisor);

module.exports = router;
