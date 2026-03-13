// server/src/app.js
// Express application setup

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimiter');
const { corsOrigin } = require('./config/cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const statusRoutes = require('./routes/statusRoutes');

const app = express();

const parseTrustProxy = (value) => {
    if (value === undefined) return false;
    if (value === 'true') return 1;
    if (value === 'false') return false;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
};

// Trust proxy only when explicitly configured; otherwise X-Forwarded-* headers can be spoofed.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// ─── Security Middleware ────────────────────────────
app.use(helmet());
app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Performance Middleware ─────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// ─── Rate Limiting ──────────────────────────────────
app.use('/api', apiLimiter);

// ─── API Routes ─────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'Vibely backend is running.',
        health: '/api/health',
    });
});

// ─── Health Check ───────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err.name === 'MulterError') {
        return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('not allowed by CORS')) {
        return res.status(403).json({ error: err.message });
    }
    if (err.message === 'Unsupported file type') {
        return res.status(400).json({ error: err.message });
    }
    res.status(err.statusCode || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

module.exports = app;
