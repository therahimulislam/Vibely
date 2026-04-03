const Message = require('../models/Message');
const { sameId } = require('./messageVisibility');

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const getVisibleUnreadConditions = (chatId, readerId, senderId = null, now = new Date()) => ({
    chatId,
    senderId: senderId ? senderId : { $ne: readerId },
    isDeleted: { $ne: true },
    deletedFor: { $ne: readerId },
    'seenBy.userId': { $ne: readerId },
    $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } },
    ],
});

const canEditMessage = (message) => {
    if (!message || message.isDeleted || message.type !== 'text') return false;
    const createdAt = new Date(message.createdAt).getTime();
    if (Number.isNaN(createdAt)) return false;
    return Date.now() - createdAt <= EDIT_WINDOW_MS;
};

const markMessagesAsSeenForReader = async ({ chatId, readerId, senderId = null }) => {
    const seenAt = new Date();
    const messages = await Message.find(getVisibleUnreadConditions(chatId, readerId, senderId, seenAt));

    if (!messages.length) {
        return [];
    }

    const changedMessages = [];
    for (const message of messages) {
        const existingEntry = (message.seenBy || []).find((entry) => sameId(entry?.userId, readerId));
        if (existingEntry) {
            existingEntry.seenAt = seenAt;
        } else {
            message.seenBy.push({ userId: readerId, seenAt });
        }

        if (message.status !== 'seen') {
            message.status = 'seen';
        }

        changedMessages.push(message);
    }

    await Promise.all(changedMessages.map((message) => message.save()));
    return changedMessages;
};

module.exports = {
    EDIT_WINDOW_MS,
    canEditMessage,
    markMessagesAsSeenForReader,
};
