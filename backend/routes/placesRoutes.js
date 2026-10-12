const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");

const {
  searchPlaces,
} = require("../controllers/placesController");

const router = express.Router();

router.get(
  "/autocomplete",
  authenticateToken,
  searchPlaces
);

module.exports = router;