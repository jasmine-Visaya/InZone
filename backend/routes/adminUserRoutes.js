
const express = require("express");

const authenticateToken = require(
  "../middleware/authMiddleware"
);

const requireAdmin = require(
  "../middleware/adminMiddleware"
);

const {
  getUsers,
  getUserById,
  updateUserDetails,
  updateUserRole,
  updateUserStatus,
} = require("../controllers/adminUserController");

const router = express.Router();

// Authentication and Admin authorization
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users
router.get("/", getUsers);

// GET /api/admin/users/:userId
router.get("/:userId", getUserById);

// PATCH /api/admin/users/:userId/role
router.patch("/:userId/role", updateUserRole);

// PATCH /api/admin/users/:userId/status
router.patch("/:userId/status", updateUserStatus);

// PATCH /api/admin/users/:userId
router.patch("/:userId", updateUserDetails);

module.exports = router;
