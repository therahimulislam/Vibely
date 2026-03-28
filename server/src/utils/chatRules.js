// server/src/utils/chatRules.js
// Shared chat settings and posting rules

const Message = require('../models/Message');

const DISAPPEARING_DURATION_OPTIONS_HOURS = [0, 24, 168, 2160];
const SLOW_MODE_OPTIONS_SECONDS = [0, 15, 30, 60, 300, 900, 3600];

const sameId = (left, right) => String(left || '') === String(right || '');
const isGroupAdmin = (chat, userId) => sameId(chat?.groupAdmin?._id || chat?.groupAdmin, userId);

const getMessageExpiryForChat = (chat, createdAt = new Date()) => {
    const hours = Number(chat?.disappearingMessages?.durationHours || 0);
    const enabled = !!chat?.disappearingMessages?.enabled && hours > 0;

    if (!enabled) return null;

    return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
};

const normalizeGroupSettings = (settings = {}) => ({
    adminOnlyMessages: !!settings.adminOnlyMessages,
    allowMemberMedia: settings.allowMemberMedia !== false,
    allowMemberPolls: settings.allowMemberPolls !== false,
    joinApprovalEnabled: !!settings.joinApprovalEnabled,
    slowModeSeconds: SLOW_MODE_OPTIONS_SECONDS.includes(Number(settings.slowModeSeconds))
        ? Number(settings.slowModeSeconds)
        : 0,
});

const normalizeDisappearingMessages = (payload = {}) => {
    const durationHours = DISAPPEARING_DURATION_OPTIONS_HOURS.includes(Number(payload.durationHours))
        ? Number(payload.durationHours)
        : 0;

    return {
        enabled: durationHours > 0,
        durationHours,
    };
};

const getActiveInviteLinks = (chat) =>
    (chat?.inviteLinks || []).filter((entry) => !entry?.revokedAt);

const ensureGroupAdmin = (chat, userId) => {
    if (!chat?.isGroup) {
        throw Object.assign(new Error('This action is only available in group chats'), { statusCode: 400 });
    }

    if (!isGroupAdmin(chat, userId)) {
        throw Object.assign(new Error('Only the group admin can do that'), { statusCode: 403 });
    }
};

const ensureCanPostInGroup = async (chat, userId, { messageType = 'text', skipSlowMode = false } = {}) => {
    if (!chat?.isGroup) return;

    if (isGroupAdmin(chat, userId)) return;

    const settings = normalizeGroupSettings(chat.groupSettings);
    const isMediaType = ['image', 'video', 'audio', 'document'].includes(messageType);

    if (settings.adminOnlyMessages) {
        throw Object.assign(new Error('Only admins can send messages right now'), { statusCode: 403 });
    }

    if (isMediaType && !settings.allowMemberMedia) {
        throw Object.assign(new Error('Only admins can share media right now'), { statusCode: 403 });
    }

    if (messageType === 'poll' && !settings.allowMemberPolls) {
        throw Object.assign(new Error('Only admins can create polls right now'), { statusCode: 403 });
    }

    if (!skipSlowMode && settings.slowModeSeconds > 0) {
        const lastMessage = await Message.findOne({
            chatId: chat._id,
            senderId: userId,
            isDeleted: { $ne: true },
        })
            .sort({ createdAt: -1 })
            .select('createdAt');

        if (lastMessage?.createdAt) {
            const elapsedSeconds = Math.floor((Date.now() - new Date(lastMessage.createdAt).getTime()) / 1000);
            if (elapsedSeconds < settings.slowModeSeconds) {
                const remaining = settings.slowModeSeconds - elapsedSeconds;
                throw Object.assign(new Error(`Slow mode is enabled. Try again in ${remaining}s`), { statusCode: 429 });
            }
        }
    }
};

module.exports = {
    DISAPPEARING_DURATION_OPTIONS_HOURS,
    SLOW_MODE_OPTIONS_SECONDS,
    sameId,
    isGroupAdmin,
    getMessageExpiryForChat,
    normalizeGroupSettings,
    normalizeDisappearingMessages,
    getActiveInviteLinks,
    ensureGroupAdmin,
    ensureCanPostInGroup,
};
