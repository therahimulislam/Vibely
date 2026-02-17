// server/src/middleware/rateLimiter.js
// Rate limiting for API endpoints

const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many auth attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Very strict limit for OTP sending
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    message: { error: 'Too many OTP requests, please wait before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, otpLimiter };
