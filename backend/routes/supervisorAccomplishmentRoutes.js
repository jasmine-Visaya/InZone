
const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const {
  getSupervisorAccomplishments,
} = require("../controllers/supervisorAccomplishmentController");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  getSupervisorAccomplishments
);

module.exports = router;
