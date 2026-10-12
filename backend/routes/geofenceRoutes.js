
const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");

const {
  checkGeofence,
  getMyApprovedGeofence,
} = require("../controllers/geofenceController");

const router = express.Router();

/* =====================================
   CHECK STUDENT GPS LOCATION
   POST /api/geofences/check
===================================== */

router.post(
  "/check",
  authenticateToken,
  checkGeofence
);

/* =====================================
   GET APPROVED OJT WORKPLACE
   GET /api/geofences/mine
===================================== */

router.get(
  "/mine",
  authenticateToken,
  getMyApprovedGeofence
);

module.exports = router;
