const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const {
  timeIn,
  timeOut,
  getMyAttendanceHistory,
  getAttendancePhotoProof,
  uploadAccomplishmentReport,
  getAccomplishmentPhoto,
  getMyAccomplishmentPhotos,
} = require("../controllers/attendanceController");

const uploadPhoto = require("../middleware/uploadMiddleware");
const uploadAccomplishmentPhotos = require("../middleware/uploadAccomplishmentMiddleware");

const router = express.Router();

// TIME IN
router.post(
  "/time-in",
  authenticateToken,
  uploadPhoto,
  timeIn
);

// TIME OUT
router.post(
  "/time-out",
  authenticateToken,
  timeOut
);

// ATTENDANCE HISTORY
router.get(
  "/my-history",
  authenticateToken,
  getMyAttendanceHistory
);

// TIME-IN PHOTO PROOF
router.get(
  "/photo-proof/:attendanceId",
  authenticateToken,
  getAttendancePhotoProof
);

// UPLOAD DAILY ACCOMPLISHMENT REPORT
router.post(
  "/accomplishment/:attendanceId",
  authenticateToken,
  uploadAccomplishmentPhotos,
  uploadAccomplishmentReport
);

// FETCH EXISTING DAILY PHOTOS FOR WEEKLY REPORT
router.get(
  "/accomplishment-photos",
  authenticateToken,
  getMyAccomplishmentPhotos
);

// VIEW ACCOMPLISHMENT REPORT
router.get(
  "/accomplishment/:attendanceId",
  authenticateToken,
  getAccomplishmentPhoto
);

module.exports = router;
