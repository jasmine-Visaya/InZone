
const express = require("express");

const authenticateToken = require(
  "../middleware/authMiddleware"
);

const {
  getStudents,
} = require("../controllers/adminStudentController");

const router = express.Router();

// All endpoints require authentication.
router.use(authenticateToken);

// Admin-only authorization.
router.use((req, res, next) => {
  const role = String(
    req.user?.role || ""
  ).toUpperCase();

  if (role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Admin access only.",
    });
  }

  next();
});

// GET /api/admin/students
router.get("/", getStudents);

module.exports = router;
