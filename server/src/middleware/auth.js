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

        const user = await User.findById(decoded.userId).select('+sessions');
        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (decoded.sessionId) {
            const activeSession = user.sessions?.find((session) => session._id.toString() === decoded.sessionId.toString());
            if (!activeSession) {
                return res.status(401).json({ error: 'Session has been revoked.', code: 'SESSION_REVOKED' });
            }

            activeSession.lastActive = new Date();
            await user.save();
        }

        req.user = user;
        req.userId = user._id;
        req.sessionId = decoded.sessionId;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = { authenticate };
