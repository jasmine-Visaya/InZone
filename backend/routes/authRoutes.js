const express = require('express');
const { rateLimit } = require('express-rate-limit');
const {
  register, login, verifyRegisterOtp, resendRegisterOtp, forgotPassword, resetPassword,
} = require('../controllers/authController');

const router = express.Router();
const limit = (count) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: count,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

router.post('/register', limit(5), register);
router.post('/login', limit(15), login);
router.post('/verify-register-otp', limit(20), verifyRegisterOtp);
router.post('/resend-register-otp', limit(6), resendRegisterOtp);
router.post('/forgot-password', limit(5), forgotPassword);
router.post('/reset-password', limit(10), resetPassword);

module.exports = router;
