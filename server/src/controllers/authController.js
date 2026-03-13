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

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const result = await authService.requestPasswordReset(req.body.email);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp, deviceId, deviceInfo } = req.body;
        const ip = req.ip;
        const userAgent = req.headers['user-agent'];
        const result = await authService.verifyOTP(email, otp, ip, userAgent, deviceId, deviceInfo);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const result = await authService.resetPasswordWithOTP(email, otp, newPassword);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password, deviceId, deviceInfo } = req.body;
        const ip = req.ip;
        const userAgent = req.headers['user-agent'];
        const result = await authService.login(email, password, ip, userAgent, deviceId, deviceInfo);
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
        const { credential, deviceId, deviceInfo } = req.body;
        const ip = req.ip;
        const userAgent = req.headers['user-agent'];
        const result = await authService.googleAuth(credential, ip, userAgent, deviceId, deviceInfo);
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

// GET /api/auth/sessions
exports.getSessions = async (req, res) => {
    try {
        const sessions = await authService.getSessions(req.user._id, req.sessionId);
        res.json({ sessions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await authService.logout(req.user._id, refreshToken);
        }
        res.json({ message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/auth/sessions/:sessionId
exports.revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        await authService.revokeSession(req.user._id, sessionId);
        res.json({ message: 'Session revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/auth/sessions
exports.revokeAllOtherSessions = async (req, res) => {
    try {
        const { currentRefreshToken } = req.body; // Client must provide its own RT to keep it alive
        await authService.revokeAllOtherSessions(req.user._id, currentRefreshToken);
        res.json({ message: 'All other sessions revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
