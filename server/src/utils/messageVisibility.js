// server/src/utils/messageVisibility.js
// Helpers for hiding sensitive message data based on the current viewer

const sameId = (left, right) => String(left || '') === String(right || '');

const isViewOnceMedia = (message = {}) =>
    !!message?.viewOnce?.enabled && ['image', 'video'].includes(message.type);

const hasViewedViewOnce = (message = {}, userId) =>
    (message?.viewOnce?.views || []).some((entry) =>
        sameId(entry?.userId?._id || entry?.userId, userId)
    );

const toPlainObject = (value) => {
    if (!value) return value;
    if (typeof value.toObject === 'function') {
        return value.toObject({ depopulate: false });
    }

    return JSON.parse(JSON.stringify(value));
};

const sanitizeViewOnceState = (viewOnce = {}, { hasViewed = false, preserveViews = false } = {}) => ({
    enabled: !!viewOnce.enabled,
    durationSeconds: Number(viewOnce.durationSeconds) || 10,
    hasViewed,
    views: preserveViews ? (viewOnce.views || []) : [],
});

const sanitizeMessageForViewer = (message, userId, options = {}) => {
    if (!message) return message;

    const { includeMediaUrl = false } = options;
    const plain = toPlainObject(message);

    if (plain.replyTo) {
        plain.replyTo = sanitizeMessageForViewer(plain.replyTo, userId);
    }

    if (!isViewOnceMedia(plain)) {
        return plain;
    }

    const isSender = sameId(plain.senderId?._id || plain.senderId, userId);
    const hasViewed = hasViewedViewOnce(plain, userId);

    plain.viewOnce = sanitizeViewOnceState(plain.viewOnce, {
        hasViewed,
        preserveViews: isSender,
    });

    if (!isSender && !includeMediaUrl) {
        plain.fileUrl = '';
        plain.fileName = '';
        plain.fileSize = 0;
        plain.publicId = '';
        plain.mediaResourceType = '';
    }

    return plain;
};

const sanitizeMessagesForViewer = (messages = [], userId, options = {}) =>
    (messages || []).map((message) => sanitizeMessageForViewer(message, userId, options));

module.exports = {
    sameId,
    isViewOnceMedia,
    hasViewedViewOnce,
    sanitizeMessageForViewer,
    sanitizeMessagesForViewer,
};
