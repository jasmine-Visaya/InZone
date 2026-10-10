const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { createGeofence, checkGeofence } = require("../controllers/geofenceController");

const router = express.Router();

router.post("/", authenticateToken, createGeofence);
router.post("/check", authenticateToken, checkGeofence);

module.exports = router;