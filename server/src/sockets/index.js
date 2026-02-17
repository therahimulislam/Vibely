// server/src/sockets/index.js
// Socket.io initialization and event handling

const { verifyAccessToken } = require('../services/tokenService');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const chatHandler = require('./chatHandler');
const callHandler = require('./callHandler');

// Map of userId -> socketId for quick lookup
const onlineUsers = new Map();

const initializeSocket = (io) => {
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.userId);
            if (!user) {
                return next(new Error('User not found'));
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
        console.log(`🟢 User connected: ${userId}`);

        // Add to online users map
        onlineUsers.set(userId, socket.id);

        // Update user status in DB
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Store in Redis if available
        const redis = getRedis();
        if (redis) {
            await redis.sadd('online_users', userId);
        }

        // Broadcast online status to all connected users
        socket.broadcast.emit('userOnline', { userId });

        // Register chat event handlers
        chatHandler(io, socket, onlineUsers);

        // Register call event handlers
        callHandler(io, socket, onlineUsers);

        // Handle disconnect
        socket.on('disconnect', async () => {
            console.log(`🔴 User disconnected: ${userId}`);

            onlineUsers.delete(userId);

            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date(),
            });

            if (redis) {
                await redis.srem('online_users', userId);
            }

            socket.broadcast.emit('userOffline', { userId, lastSeen: new Date() });
        });
    });
};

const getOnlineUsers = () => onlineUsers;

module.exports = { initializeSocket, getOnlineUsers };
