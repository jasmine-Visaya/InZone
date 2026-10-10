const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { createProfile, getProfile, updateProfile } = require("../controllers/ojtController");

const router = express.Router();

router.post("/profile", authenticateToken, createProfile);
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);

module.exports = router;