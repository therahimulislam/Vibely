// server/src/scripts/checkEnv.js
// Lightweight environment preflight for local/dev/CI verification

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '../../..');
const serverEnvPath = path.join(rootDir, 'server', '.env');
const clientEnvPath = path.join(rootDir, 'client', '.env');

if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
}

if (fs.existsSync(clientEnvPath)) {
    dotenv.config({ path: clientEnvPath, override: false });
}

const requiredVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'REFRESH_SECRET',
];

const optionalVars = [
    'CLIENT_URL',
    'GOOGLE_CLIENT_ID',
    'EMAIL_SCRIPT_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];

const missingRequired = requiredVars.filter((key) => !process.env[key]);
const missingOptional = optionalVars.filter((key) => !process.env[key]);

if (missingRequired.length > 0) {
    console.error(`Missing required environment variables: ${missingRequired.join(', ')}`);
    process.exit(1);
}

if (missingOptional.length > 0) {
    console.warn(`Warning: optional environment variables missing: ${missingOptional.join(', ')}`);
}

if (process.env.CLIENT_URL) {
    const origins = process.env.CLIENT_URL.split(',').map((value) => value.trim()).filter(Boolean);
    if (origins.some((origin) => origin.endsWith('/'))) {
        console.warn('Warning: CLIENT_URL contains trailing slash values. These are normalized at runtime, but trimming them is recommended.');
    }
}

if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL && !process.env.CLIENT_URLS) {
    console.warn('Warning: CLIENT_URL is not set in production. Browser login requests from your frontend will usually fail due to CORS.');
}

console.log('Environment preflight passed.');
