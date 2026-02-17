// server/src/services/authService.js
// Business logic for authentication operations

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('./tokenService');
const { sendOTPEmail } = require('./emailService');
const { OAuth2Client } = require('google-auth-library');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: Create and add session
const createSession = async (user, refreshToken, ip, userAgent, clientDeviceInfo = {}) => {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const geo = geoip.lookup(ip);

    // Prefer client device info if available
    const browserName = clientDeviceInfo.browserName || result.browser.name || 'Unknown';
    const browserVersion = clientDeviceInfo.browserVersion || result.browser.version || '';
    const osName = clientDeviceInfo.platformName || result.os.name || 'Unknown';
    const osVersion = clientDeviceInfo.osVersion || result.os.version || '';
    const deviceModel = clientDeviceInfo.model || (result.device.model ? `${result.device.vendor || ''} ${result.device.model}` : 'Desktop');

    const session = {
        refreshToken,
        browser: `${browserName} ${browserVersion}`.trim(),
        os: `${osName} ${osVersion}`.trim(),
        device: deviceModel.trim(),
        ip: ip || 'Unknown',
        location: geo ? `${geo.city || ''}, ${geo.country || ''}`.trim() : 'Unknown',
        lastActive: new Date(),
        deviceId: clientDeviceInfo.deviceId, // Persist device ID if sent
    };

    // If deviceId provided, remove old session with same deviceId to prevent duplicates?
    // Or just push new one? User wants "Real device id in session".
    // I'll update existing session if deviceId matches?
    // Probably better to just add (multiple logins from same device might be valid if different browsers/private mode, but if deviceId persists, it's same "device").
    // Let's just push for now.

    user.sessions.push(session);
    await user.save();
    return user.sessions[user.sessions.length - 1];
};

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register a new user
const signup = async ({ name, email, password }) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw Object.assign(new Error('Email already registered'), { statusCode: 400 });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
        name,
        email,
        password,
        otp,
        otpExpiry,
        isVerified: false,
    });

    // Send OTP email
    await sendOTPEmail(email, otp);

    return { message: 'Account created. Please verify your email with the OTP sent.', userId: user._id };
};

// Send OTP to existing user
const sendOTP = async (email) => {
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, otp);

    return { message: 'OTP sent to your email' };
};

// Verify OTP
const verifyOTP = async (email, otp, ip, userAgent, deviceId, deviceInfo) => {
    const clientDeviceInfo = { ...deviceInfo, deviceId };
    const user = await User.findOne({ email }).select('+otp +otpExpiry +sessions');
    // ... (rest same)
    if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    if (!user.otp || user.otp !== otp) {
        throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
    }

    if (user.otpExpiry < new Date()) {
        throw Object.assign(new Error('OTP has expired'), { statusCode: 400 });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, ip, userAgent, clientDeviceInfo);
    const accessToken = generateAccessToken(user._id, session._id);

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Login with email and password
const login = async (email, password, ip, userAgent, deviceId, deviceInfo) => {
    const clientDeviceInfo = { ...deviceInfo, deviceId };
    const user = await User.findOne({ email }).select('+password +sessions');
    // ... (rest same)
    if (!user) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    if (!user.password) {
        throw Object.assign(new Error('Please login with Google'), { statusCode: 401 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    if (!user.isVerified) {
        // ... (otp logic)
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendOTPEmail(email, otp);
        throw Object.assign(new Error('Email not verified. New OTP sent.'), { statusCode: 403, needsVerification: true });
    }

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, ip, userAgent, clientDeviceInfo);
    const accessToken = generateAccessToken(user._id, session._id);

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Google OAuth
const googleAuth = async (credential, ip, userAgent, deviceId, deviceInfo) => {
    const clientDeviceInfo = { ...deviceInfo, deviceId };
    // ... (google verify)
    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, name, email, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] }).select('+sessions');

    if (user) {
        if (!user.googleId) {
            user.googleId = googleId;
            user.avatar = user.avatar || picture;
        }
        user.isVerified = true;
    } else {
        user = new User({
            name,
            email,
            googleId,
            avatar: picture,
            isVerified: true,
        });
    }

    await user.save();

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, ip, userAgent, clientDeviceInfo);
    const accessToken = generateAccessToken(user._id, session._id);

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).select('+sessions');

    if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 401 });
    }

    const session = user.sessions.find(s => s.refreshToken === refreshToken);
    if (!session) {
        throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    // Update last active
    session.lastActive = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id, session._id);
    return { accessToken };
};

// Get active sessions
const getSessions = async (userId, currentSessionId) => {
    const user = await User.findById(userId).select('+sessions');
    return user.sessions.map(s => ({
        _id: s._id,
        device: s.device,
        browser: s.browser,
        os: s.os,
        ip: s.ip,
        location: s.location,
        lastActive: s.lastActive,
        isCurrent: currentSessionId ? s._id.toString() === currentSessionId.toString() : false
    }));
};

// Logout (Revoke specific token)
const logout = async (userId, refreshToken) => {
    const user = await User.findById(userId).select('+sessions');
    if (user) {
        user.sessions = user.sessions.filter(s => s.refreshToken !== refreshToken);
        await user.save();
    }
    return { message: 'Logged out' };
};

// Revoke specific session
const revokeSession = async (userId, sessionId) => {
    const user = await User.findById(userId).select('+sessions');
    if (user) {
        user.sessions = user.sessions.filter(s => s._id.toString() !== sessionId);
        await user.save();
    }
    return { message: 'Session revoked' };
};

// Revoke all other sessions
const revokeAllOtherSessions = async (userId, currentRefreshToken) => {
    const user = await User.findById(userId).select('+sessions');
    if (user) {
        user.sessions = user.sessions.filter(s => s.refreshToken === currentRefreshToken);
        await user.save();
    }
    return { message: 'All other sessions revoked' };
};

module.exports = {
    signup,
    sendOTP,
    verifyOTP,
    login,
    googleAuth,
    refreshAccessToken,
    getSessions,
    logout,
    revokeSession,
    revokeAllOtherSessions
};
