// server/src/routes/authRoutes.js
// Authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateSignup, validateLogin, validateOTP } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/send-otp', otpLimiter, authController.sendOTP);
router.post('/verify-otp', authLimiter, validateOTP, authController.verifyOTP);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/google', authLimiter, authController.googleAuth);
router.post('/refresh', authController.refreshToken);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
