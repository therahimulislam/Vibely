// server/src/services/tokenService.js
// JWT token generation and verification

const jwt = require('jsonwebtoken');

const generateAccessToken = (userId, sessionId) => {
    return jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.REFRESH_SECRET);
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};
