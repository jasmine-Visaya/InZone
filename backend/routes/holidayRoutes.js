const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holidayController");

const router = express.Router();

// Everyone logged in can read holidays (students, supervisors, admins).
router.get("/", authenticateToken, listHolidays);

// Only admins can change them.
router.post("/", authenticateToken, requireAdmin, createHoliday);
router.put("/:id", authenticateToken, requireAdmin, updateHoliday);
router.delete("/:id", authenticateToken, requireAdmin, deleteHoliday);

module.exports = router;
