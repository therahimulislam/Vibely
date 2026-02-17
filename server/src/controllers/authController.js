// server/src/controllers/authController.js
// Authentication controller - handles HTTP auth requests

const authService = require('../services/authService');
const User = require('../models/User');

// POST /api/auth/signup
exports.signup = async (req, res) => {
    try {
        const result = await authService.signup(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/send-otp
exports.sendOTP = async (req, res) => {
    try {
        const result = await authService.sendOTP(req.body.email);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const result = await authService.verifyOTP(email, otp);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);
        res.json(result);
    } catch (error) {
        const response = { error: error.message };
        if (error.needsVerification) response.needsVerification = true;
        res.status(error.statusCode || 500).json(response);
    }
};

// POST /api/auth/google
exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        const result = await authService.googleAuth(credential);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const result = await authService.refreshAccessToken(refreshToken);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
