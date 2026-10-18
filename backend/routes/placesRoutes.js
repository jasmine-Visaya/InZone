const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");

const { searchPlaces } = require("../controllers/placesController");

const router = express.Router();

// =====================================
// WORKPLACE ADDRESS AUTOCOMPLETE
// GET /api/places/autocomplete?q=
// =====================================
router.get("/autocomplete", authenticateToken, searchPlaces);

module.exports = router;
