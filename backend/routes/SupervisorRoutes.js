const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");
const requireSupervisor = require("../middleware/supervisorMiddleware");

const {
  getDashboard,
  getMyStudents,
  getStudentDetails,
  getAttendanceByDate,
  getProfile,
} = require("../controllers/supervisorController");

const router = express.Router();

// Every route here needs a logged-in SUPERVISOR.
// Each query only returns students assigned to that supervisor.
router.use(authenticateToken, requireSupervisor);

router.get("/dashboard", getDashboard);
router.get("/students", getMyStudents);
router.get("/students/:studentId", getStudentDetails);
router.get("/attendance", getAttendanceByDate);
router.get("/profile", getProfile);

module.exports = router;
