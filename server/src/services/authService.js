// server/src/services/authService.js
// Business logic for authentication operations

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('./tokenService');
const { sendOTPEmail } = require('./emailService');
const { OAuth2Client } = require('google-auth-library');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const GENERIC_VERIFICATION_MESSAGE = 'If an account needs verification, a code has been sent to the email provided.';
const PASSWORD_RESET_MESSAGE = 'Password reset OTP sent to your email.';

const slugifyUsername = (value = '') => value
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 20);

const generateUniqueUsername = async (name, email) => {
    const emailPrefix = email?.split('@')[0] || '';
    const base = slugifyUsername(name) || slugifyUsername(emailPrefix) || `user${Date.now().toString().slice(-6)}`;

    let candidate = base;
    let counter = 0;

    while (await User.exists({ username: candidate })) {
        counter += 1;
        candidate = `${base.slice(0, Math.max(3, 20 - `${counter}`.length))}${counter}`;
    }

    return candidate;
};

const ensureUsername = async (user) => {
    if (user.username) return user.username;
    user.username = await generateUniqueUsername(user.name, user.email);
    await user.save();
    return user.username;
};

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

    const sessionPayload = {
        refreshToken,
        browser: `${browserName} ${browserVersion}`.trim(),
        os: `${osName} ${osVersion}`.trim(),
        device: deviceModel.trim(),
        ip: ip || 'Unknown',
        location: geo ? `${geo.city || ''}, ${geo.country || ''}`.trim() : 'Unknown',
        lastActive: new Date(),
        deviceId: clientDeviceInfo.deviceId, // Persist device ID if sent
    };

    const existingSession = clientDeviceInfo.deviceId
        ? user.sessions.find((session) => session.deviceId && session.deviceId === clientDeviceInfo.deviceId)
        : null;

    if (existingSession) {
        Object.assign(existingSession, sessionPayload);
        await user.save();
        return existingSession;
    }

    user.sessions.push(sessionPayload);
    await user.save();
    return user.sessions[user.sessions.length - 1];
};

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOTPExpiry = () => new Date(Date.now() + OTP_EXPIRY_MS);

const setVerificationOTP = (user, otp) => {
    user.verificationOtp = otp;
    user.verificationOtpExpiry = getOTPExpiry();
    // Backward-compatibility cleanup for any legacy pending users.
    user.otp = undefined;
    user.otpExpiry = undefined;
};

const clearVerificationOTP = (user) => {
    user.verificationOtp = undefined;
    user.verificationOtpExpiry = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
};

const setResetOTP = (user, otp) => {
    user.resetOtp = otp;
    user.resetOtpExpiry = getOTPExpiry();
};

const clearResetOTP = (user) => {
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
};

const getVerificationOTPValue = (user) => user.verificationOtp || user.otp;
const getVerificationOTPExpiry = (user) => user.verificationOtpExpiry || user.otpExpiry;

// Register a new user
const signup = async ({ name, email, password }) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw Object.assign(new Error('Email already registered'), { statusCode: 400 });
    }

    const username = await generateUniqueUsername(name, email);

    const otp = generateOTP();

    const user = await User.create({
        name,
        username,
        email,
        password,
        verificationOtp: otp,
        verificationOtpExpiry: getOTPExpiry(),
        isVerified: false,
    });

    // Send OTP email
    await sendOTPEmail(email, otp);

    return { message: 'Account created. Please verify your email with the OTP sent.', userId: user._id, username };
};

// Send OTP to existing user
const sendOTP = async (email) => {
    const user = await User.findOne({ email }).select('+verificationOtp +verificationOtpExpiry +otp +otpExpiry');

    if (user && !user.isVerified) {
        const otp = generateOTP();
        setVerificationOTP(user, otp);
        await user.save();
        await sendOTPEmail(email, otp);
    }

    return { message: GENERIC_VERIFICATION_MESSAGE };
};

// Send OTP for password reset
const requestPasswordReset = async (email) => {
    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpiry');

    if (!user) {
        throw Object.assign(new Error('Account not found'), { statusCode: 404 });
    }

    const otp = generateOTP();
    setResetOTP(user, otp);
    await user.save();
    await sendOTPEmail(email, otp);

    return { message: PASSWORD_RESET_MESSAGE };
};

// Verify OTP
const verifyOTP = async (email, otp, ip, userAgent, deviceId, deviceInfo) => {
    const clientDeviceInfo = { ...deviceInfo, deviceId };
    const user = await User.findOne({ email }).select('+verificationOtp +verificationOtpExpiry +otp +otpExpiry +sessions');
    if (!user) {
        throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
    }

    if (!getVerificationOTPValue(user) || getVerificationOTPValue(user) !== otp) {
        throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
    }

    if (getVerificationOTPExpiry(user) < new Date()) {
        throw Object.assign(new Error('OTP has expired'), { statusCode: 400 });
    }

    user.isVerified = true;
    clearVerificationOTP(user);
    await ensureUsername(user);
    await user.save();

    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, ip, userAgent, clientDeviceInfo);
    const accessToken = generateAccessToken(user._id, session._id);

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Reset password with OTP
const resetPasswordWithOTP = async (email, otp, newPassword) => {
    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpiry +password +sessions');
    if (!user) {
        throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
        throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
    }

    if (user.resetOtpExpiry < new Date()) {
        throw Object.assign(new Error('OTP has expired'), { statusCode: 400 });
    }

    user.password = newPassword;
    user.isVerified = true;
    clearResetOTP(user);
    // Resetting a password should invalidate every existing session.
    user.sessions = [];
    await user.save();

    return { message: 'Password reset successful. You can now sign in.' };
};

// Login with email and password
const login = async (email, password, ip, userAgent, deviceId, deviceInfo) => {
    const clientDeviceInfo = { ...deviceInfo, deviceId };
    const user = await User.findOne({ email }).select('+password +sessions');
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
        const otp = generateOTP();
        setVerificationOTP(user, otp);
        await user.save();
        await sendOTPEmail(email, otp);
        throw Object.assign(new Error('Email not verified. New OTP sent.'), { statusCode: 403, needsVerification: true });
    }

    await ensureUsername(user);
    const refreshToken = generateRefreshToken(user._id);
    const session = await createSession(user, refreshToken, ip, userAgent, clientDeviceInfo);
    const accessToken = generateAccessToken(user._id, session._id);

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Google OAuth
const googleAuth = async (credential, ip, userAgent, deviceId, deviceInfo) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw Object.assign(new Error('Google sign-in is not configured on the server'), { statusCode: 500 });
    }

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
        const username = await generateUniqueUsername(name, email);
        user = new User({
            name,
            username,
            email,
            googleId,
            avatar: picture,
            isVerified: true,
        });
    }

    await ensureUsername(user);
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
    requestPasswordReset,
    verifyOTP,
    resetPasswordWithOTP,
    login,
    googleAuth,
    refreshAccessToken,
    getSessions,
    logout,
    revokeSession,
    revokeAllOtherSessions
};
