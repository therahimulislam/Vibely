// server/src/middleware/validate.js
// Request validation middleware using express-validator

const { body, validationResult } = require('express-validator');

// Check for validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array().map((e) => e.msg) });
    }
    next();
};

// Validation rules
const validateSignup = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    handleValidation,
];

const validateLogin = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidation,
];

const validateOTP = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    handleValidation,
];

const validateMessage = [
    body('chatId').notEmpty().withMessage('Chat ID is required'),
    handleValidation,
];

module.exports = { validateSignup, validateLogin, validateOTP, validateMessage };
