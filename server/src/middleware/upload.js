// server/src/middleware/upload.js
// Multer configuration for safe file uploads

const multer = require('multer');
const path = require('path');

const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

const VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
]);

const DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
]);

const MESSAGE_ALLOWED_TYPES = new Set([
    ...IMAGE_MIME_TYPES,
    ...VIDEO_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
]);

const STATUS_ALLOWED_TYPES = new Set([
    ...IMAGE_MIME_TYPES,
    ...VIDEO_MIME_TYPES,
]);

const AVATAR_ALLOWED_TYPES = new Set(IMAGE_MIME_TYPES);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/tmp');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
    },
});

const getAllowedTypes = (req, file) => {
    if (file.fieldname === 'avatar') return AVATAR_ALLOWED_TYPES;
    if (file.fieldname === 'media' && req.baseUrl === '/api/status') return STATUS_ALLOWED_TYPES;
    return MESSAGE_ALLOWED_TYPES;
};

const fileFilter = (req, file, cb) => {
    const allowedTypes = getAllowedTypes(req, file);

    if (!allowedTypes.has(file.mimetype)) {
        return cb(new Error('Unsupported file type'));
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
});

module.exports = upload;
