// server/src/middleware/auth.js
// JWT authentication middleware

const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyAccessToken(token);

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = { authenticate };
