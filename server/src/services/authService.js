// server/src/services/authService.js
// Business logic for authentication operations

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('./tokenService');
const { sendOTPEmail } = require('./emailService');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
const verifyOTP = async (email, otp) => {
    const user = await User.findOne({ email }).select('+otp +otpExpiry');
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

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Login with email and password
const login = async (email, password) => {
    const user = await User.findOne({ email }).select('+password');
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
        // Send new OTP for verification
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        await sendOTPEmail(email, otp);
        throw Object.assign(new Error('Email not verified. New OTP sent.'), { statusCode: 403, needsVerification: true });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Google OAuth
const googleAuth = async (credential) => {
    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, name, email, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
        // Link Google account if not already linked
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

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    return { user: user.toJSON(), accessToken, refreshToken };
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
        throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    const accessToken = generateAccessToken(user._id);
    return { accessToken };
};

module.exports = { signup, sendOTP, verifyOTP, login, googleAuth, refreshAccessToken };
