// server/src/models/User.js
// User model with auth, profile, and online status fields

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 30,
            match: [/^[a-z0-9._]+$/, 'Username can contain lowercase letters, numbers, dots, and underscores only'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        password: {
            type: String,
            minlength: 6,
            select: false, // Don't include password by default in queries
        },
        googleId: {
            type: String,
            sparse: true,
        },
        avatar: {
            type: String,
            default: '',
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        isOnline: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: String,
            select: false,
        },
        otpExpiry: {
            type: Date,
            select: false,
        },
        verificationOtp: {
            type: String,
            select: false,
        },
        verificationOtpExpiry: {
            type: Date,
            select: false,
        },
        resetOtp: {
            type: String,
            select: false,
        },
        resetOtpExpiry: {
            type: Date,
            select: false,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        contacts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        sessions: [
            {
                refreshToken: String,
                deviceId: String,
                browser: String,
                os: String,
                device: String,
                ip: String,
                location: String,
                lastActive: Date,
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.otp;
    delete user.otpExpiry;
    delete user.verificationOtp;
    delete user.verificationOtpExpiry;
    delete user.resetOtp;
    delete user.resetOtpExpiry;
    delete user.sessions;
    delete user.__v;
    return user;
};

module.exports = mongoose.model('User', userSchema);
