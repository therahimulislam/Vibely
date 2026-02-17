// server/src/utils/constants.js
// Application constants

module.exports = {
    MESSAGE_STATUS: {
        SENT: 'sent',
        DELIVERED: 'delivered',
        SEEN: 'seen',
    },
    OTP_EXPIRY_MINUTES: 10,
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    MESSAGES_PER_PAGE: 30,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    MESSAGE_EDIT_WINDOW: 15 * 60 * 1000, // 15 minutes
};
