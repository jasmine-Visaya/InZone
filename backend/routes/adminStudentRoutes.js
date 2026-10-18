const express = require("express");

// Authentication Middleware
const authenticateToken = require("../middleware/authMiddleware");

// Admin Authorization Middleware
const requireAdmin = require("../middleware/adminMiddleware");

// Student Controllers
const {
  getStudents,
  updateStudentAccountStatus,
  updateStudentDetails,
} = require("../controllers/adminStudentController");

const router = express.Router();

// =====================================
// AUTHENTICATION & AUTHORIZATION
// =====================================

// Check JWT token first
router.use(authenticateToken);

// Verify current ADMIN role and account status
router.use(requireAdmin);

// =====================================
// GET ALL STUDENTS
// GET /api/admin/students
// =====================================
router.get("/", getStudents);

// =====================================
// APPROVE / REJECT STUDENT ACCOUNT
// PATCH /api/admin/students/:studentId/status
// =====================================

// Original endpoint — preserved
router.patch("/:studentId/status", updateStudentAccountStatus);

// Alternative endpoint for new frontend
router.patch("/:studentId/account-status", updateStudentAccountStatus);

// =====================================
// UPDATE STUDENT DETAILS
// PATCH /api/admin/students/:studentId
// =====================================

// Existing endpoint — preserved
router.patch("/:studentId", updateStudentDetails);

module.exports = router;
