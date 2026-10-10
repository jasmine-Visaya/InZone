const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { timeIn, timeOut, getMyAttendanceHistory, getAttendancePhotoProof } = require("../controllers/attendanceController");
const uploadPhoto = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post(
    "/time-in",
    authenticateToken,
    uploadPhoto,
    timeIn
);
router.post("/time-out", authenticateToken, timeOut);
router.get("/my-history", authenticateToken, getMyAttendanceHistory);
router.get(
    "/photo-proof/:attendanceId",
    authenticateToken,
    getAttendancePhotoProof
);

module.exports = router;