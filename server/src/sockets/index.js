// Socket.io initialization and event handling

const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const chatHandler = require('./chatHandler');
const callHandler = require('./callHandler');

// Map of userId -> Set<socketId> for multi-tab/device presence tracking
const onlineUsers = new Map();

const initializeSocket = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.userId).select('+sessions');
            if (!user) {
                return next(new Error('User not found'));
            }

            if (decoded.sessionId) {
                const activeSession = user.sessions?.find((session) => session._id.toString() === decoded.sessionId.toString());
                if (!activeSession) {
                    return next(new Error('Session revoked'));
                }
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        console.log(`User connected: ${userId}`);
        socket.join(`user:${userId}`);

        const userSockets = onlineUsers.get(userId) || new Set();
        const wasOffline = userSockets.size === 0;
        userSockets.add(socket.id);
        onlineUsers.set(userId, userSockets);

        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        const redis = getRedis();
        if (redis) {
            await redis.sadd('online_users', userId);
        }

        socket.emit('onlineUsers', { userIds: [...onlineUsers.keys()] });

        if (wasOffline) {
            socket.broadcast.emit('userOnline', { userId });
        }

        chatHandler(io, socket, onlineUsers);
        callHandler(io, socket, onlineUsers);

        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${userId}`);

            const activeSockets = onlineUsers.get(userId);
            if (activeSockets) {
                activeSockets.delete(socket.id);
                if (activeSockets.size === 0) {
                    onlineUsers.delete(userId);
                } else {
                    onlineUsers.set(userId, activeSockets);
                }
            }

            const isStillOnline = onlineUsers.has(userId);

            if (!isStillOnline) {
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastSeen: new Date(),
                });

                if (redis) {
                    await redis.srem('online_users', userId);
                }

                socket.broadcast.emit('userOffline', { userId, lastSeen: new Date() });
            }
        });
    });
};

const getOnlineUsers = () => onlineUsers;

module.exports = { initializeSocket, getOnlineUsers };
