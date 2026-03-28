// server/src/server.js
// Main entry point - HTTP server + Socket.io

require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { configureCloudinary } = require('./config/cloudinary');
const { initializeSocket } = require('./sockets');
const { initCronJobs } = require('./services/cronService');
const { corsOrigin, allowedOrigins } = require('./config/cors');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});
app.set('io', io);

// Initialize Cron Jobs
initCronJobs(io);

// Startup sequence
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Connect to Redis (non-blocking, app works without it)
        connectRedis();

        // Configure Cloudinary
        configureCloudinary();

        // Initialize Socket.io handlers
        initializeSocket(io);

        // Start server
        server.listen(PORT, () => {
            console.log(`\n🚀 Vibely server running on port ${PORT}`);
            console.log(`📡 API: http://localhost:${PORT}/api`);
            console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
            console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
            console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
