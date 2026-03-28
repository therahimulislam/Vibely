// server/src/controllers/messageController.js
// Message controller - send, retrieve, edit, delete, react

const Message = require('../models/Message');
const ScheduledMessage = require('../models/ScheduledMessage');
const Chat = require('../models/Chat');
const { uploadFile, deleteImage } = require('../services/cloudinaryService');
const fs = require('fs');
const { randomUUID } = require('crypto');
const {
    sanitizeMessageForViewer,
    sanitizeMessagesForViewer,
    hasViewedViewOnce,
    sameId,
} = require('../utils/messageVisibility');

const MESSAGE_SENDER_FIELDS = 'name avatar username';
const REPLY_PREVIEW_FIELDS = 'text type fileUrl fileName createdAt isDeleted poll forwardedFrom viewOnce';
const URL_PATTERN = /(https?:\/\/|www\.)/i;
const cleanupTempFile = (filePath) => {
    if (filePath) {
        fs.unlink(filePath, () => { });
    }
};
const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getMediaResourceType = (messageType = 'image') => {
    if (messageType === 'document') return 'raw';
    if (messageType === 'video' || messageType === 'audio') return 'video';
    return 'image';
};
const parseViewOncePayload = (body = {}, messageType = '') => {
    const requested = body.viewOnce === true || `${body.viewOnce}` === 'true';
    const duration = Math.min(Math.max(parseInt(body.viewOnceDuration, 10) || 10, 3), 30);

    return {
        requested,
        config: {
            enabled: requested && ['image', 'video'].includes(messageType),
            durationSeconds: duration,
            views: [],
        },
    };
};

const populateMessage = (messageId) => Message.findById(messageId)
    .populate('senderId', MESSAGE_SENDER_FIELDS)
    .populate('reactions.userId', 'name')
    .populate({
        path: 'replyTo',
        select: `${REPLY_PREVIEW_FIELDS} senderId`,
        populate: {
            path: 'senderId',
            select: MESSAGE_SENDER_FIELDS,
        },
    });

const populateScheduledMessage = (scheduledMessageId) => ScheduledMessage.findById(scheduledMessageId)
    .populate('senderId', MESSAGE_SENDER_FIELDS)
    .populate({
        path: 'replyTo',
        select: `${REPLY_PREVIEW_FIELDS} senderId`,
        populate: {
            path: 'senderId',
            select: MESSAGE_SENDER_FIELDS,
        },
    });

const updateChatAfterMessage = async (chat, senderId, messageId) => {
    chat.lastMessage = messageId;
    chat.updatedAt = new Date();
    chat.deletedBy = [];
    chat.archivedBy = [];

    chat.participants.forEach((participantId) => {
        if (participantId.toString() !== senderId.toString()) {
            const count = chat.unreadCount.get(participantId.toString()) || 0;
            chat.unreadCount.set(participantId.toString(), count + 1);
        }
    });

    await chat.save();
};

const emitToChatParticipants = (reqOrIo, chat, eventName, payload, senderId) => {
    const io = typeof reqOrIo?.to === 'function' ? reqOrIo : reqOrIo?.app?.get('io');
    if (!io) return;

    chat.participants.forEach((participantId) => {
        const userId = participantId.toString();
        if (senderId && userId === senderId.toString()) return;
        io.to(`user:${userId}`).emit(eventName, typeof payload === 'function' ? payload(userId) : payload);
    });
};

const ensureDirectChatCanSend = (chat, actorId) => {
    if (!chat.isGroup && chat.requestStatus === 'pending' && chat.requestedBy?.toString() !== actorId.toString()) {
        throw Object.assign(new Error('Accept this chat request before replying'), { statusCode: 403 });
    }

    if (!chat.isGroup && chat.requestStatus === 'rejected') {
        throw Object.assign(new Error('This chat request has been rejected'), { statusCode: 403 });
    }
};

const getReplyMessage = async (chatId, replyTo) => {
    if (!replyTo) return null;

    const replyMessage = await Message.findOne({ _id: replyTo, chatId });
    if (!replyMessage) {
        throw Object.assign(new Error('Reply target not found in this chat'), { statusCode: 400 });
    }

    return replyMessage;
};

const ensureChatParticipant = async (chatId, userId) => {
    const chat = await Chat.findOne({
        _id: chatId,
        participants: userId,
    });

    if (!chat) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    return chat;
};

const ensureChatAccessForMessages = async (chatId, userId) => {
    const chat = await ensureChatParticipant(chatId, userId);
    ensureDirectChatCanSend(chat, userId);
    return chat;
};

const ensureCanPinMessage = (chat, userId) => {
    if (!chat.isGroup) return;

    if (chat.groupAdmin?.toString() !== userId.toString()) {
        throw Object.assign(new Error('Only group admins can pin messages'), { statusCode: 403 });
    }
};

// GET /api/messages/:chatId - Get messages with pagination
exports.getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        // Verify user is participant of this chat
        await ensureChatParticipant(chatId, req.userId);

        const messages = await Message.find({
            chatId,
            deletedFor: { $ne: req.userId }, // Exclude deleted-for-me messages
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate('reactions.userId', 'name')
            .populate({
                path: 'replyTo',
                select: `${REPLY_PREVIEW_FIELDS} senderId`,
                populate: {
                    path: 'senderId',
                    select: MESSAGE_SENDER_FIELDS,
                },
            });

        const visibleTotal = await Message.countDocuments({
            chatId,
            deletedFor: { $ne: req.userId },
        });

        res.json({
            messages: sanitizeMessagesForViewer(messages.reverse(), req.userId),
            pagination: {
                page,
                limit,
                total: visibleTotal,
                pages: Math.ceil(visibleTotal / limit),
                hasMore: skip + limit < visibleTotal,
            },
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// GET /api/messages/:chatId/search - Search messages with filters
exports.searchMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const {
            query = '',
            filter = 'all',
            senderId,
            dateFrom,
            dateTo,
            limit = 50,
        } = req.query;

        const chat = await ensureChatParticipant(chatId, req.userId);
        const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const conditions = {
            chatId,
            deletedFor: { $ne: req.userId },
        };

        if (chat.isGroup && senderId) {
            const senderIsParticipant = chat.participants.some((participantId) => participantId.toString() === senderId.toString());
            if (senderIsParticipant) {
                conditions.senderId = senderId;
            }
        }

        if (dateFrom || dateTo) {
            conditions.createdAt = {};
            if (dateFrom) {
                conditions.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const inclusiveEnd = new Date(dateTo);
                inclusiveEnd.setHours(23, 59, 59, 999);
                conditions.createdAt.$lte = inclusiveEnd;
            }
        }

        const normalizedQuery = query.trim();
        if (normalizedQuery) {
            const regex = new RegExp(escapeRegExp(normalizedQuery), 'i');
            conditions.$or = [
                { text: regex },
                { fileName: regex },
                { 'poll.question': regex },
                { 'forwardedFrom.senderName': regex },
            ];
        }

        switch (filter) {
            case 'media':
                conditions.type = { $in: ['image', 'video'] };
                break;
            case 'documents':
                conditions.type = 'document';
                break;
            case 'audio':
                conditions.type = 'audio';
                break;
            case 'polls':
                conditions.type = 'poll';
                break;
            case 'links':
                conditions.text = URL_PATTERN;
                break;
            case 'photos':
                conditions.type = 'image';
                break;
            case 'videos':
                conditions.type = 'video';
                break;
            default:
                break;
        }

        const results = await Message.find(conditions)
            .sort({ createdAt: -1 })
            .limit(normalizedLimit)
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate('reactions.userId', 'name')
            .populate({
                path: 'replyTo',
                select: `${REPLY_PREVIEW_FIELDS} senderId`,
                populate: {
                    path: 'senderId',
                    select: MESSAGE_SENDER_FIELDS,
                },
            });

        res.json({ results: sanitizeMessagesForViewer(results, req.userId) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// POST /api/messages/send - Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { chatId, text, replyTo } = req.body;
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        const chat = await ensureChatAccessForMessages(chatId, req.userId);
        const replyMessage = await getReplyMessage(chatId, replyTo);

        // Handle file upload
        let fileData = {
            fileUrl: '',
            fileName: '',
            fileSize: 0,
            publicId: '',
            type: 'text',
        };

        if (req.file) {
            const isDocumentMode = req.body.type === 'document';
            const isAudioMode = req.body.type === 'audio' || req.file.mimetype.startsWith('audio/');
            const resourceType = isDocumentMode ? 'raw' : isAudioMode ? 'video' : 'auto';

            const result = await uploadFile(req.file.path, 'vibely/messages', resourceType);

            fileData = {
                fileUrl: result.url,
                fileName: req.file.originalname,
                fileSize: result.bytes || req.file.size,
                publicId: result.publicId,
                mediaResourceType: result.resourceType || getMediaResourceType(isAudioMode ? 'audio' : isDocumentMode ? 'document' : 'image'),
                type: 'document', // Default to document
            };

            // Determine specific type based on Cloudinary resource_type or mimetype
            if (isAudioMode) {
                fileData.type = 'audio';
            } else if (!isDocumentMode && (result.resourceType === 'image' || req.file.mimetype.startsWith('image/'))) {
                fileData.type = 'image';
            } else if (!isDocumentMode && (result.resourceType === 'video' || req.file.mimetype.startsWith('video/'))) {
                fileData.type = 'video';
            }
            // If isDocumentMode is true, it stays 'document' (default)

        }

        const viewOnce = parseViewOncePayload(req.body, fileData.type);
        if (viewOnce.requested && !viewOnce.config.enabled) {
            return res.status(400).json({ error: 'View-once is only available for photos and videos' });
        }

        if (!normalizedText && !fileData.fileUrl) {
            return res.status(400).json({ error: 'Message must have text or media' });
        }

        const message = await Message.create({
            chatId,
            senderId: req.userId,
            text: normalizedText,
            replyTo: replyMessage?._id || null,
            ...fileData,
            viewOnce: viewOnce.config,
            status: 'sent',
        });

        await updateChatAfterMessage(chat, req.userId, message._id);

        const populatedMessage = await populateMessage(message._id);
        emitToChatParticipants(req, chat, 'receiveMessage', (viewerId) => ({
            message: sanitizeMessageForViewer(populatedMessage, viewerId),
            chatId,
        }), req.userId);

        res.status(201).json({ message: sanitizeMessageForViewer(populatedMessage, req.userId) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    } finally {
        cleanupTempFile(req.file?.path);
    }
};

// POST /api/messages/scheduled - Schedule a message for later delivery
exports.scheduleMessage = async (req, res) => {
    try {
        const { chatId, text, replyTo, scheduledFor } = req.body;
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        await ensureChatAccessForMessages(chatId, req.userId);
        const replyMessage = await getReplyMessage(chatId, replyTo);
        const deliveryAt = new Date(scheduledFor);

        if (Number.isNaN(deliveryAt.getTime())) {
            return res.status(400).json({ error: 'Choose a valid delivery time' });
        }

        if (deliveryAt.getTime() <= Date.now() + 15000) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }

        let fileData = {
            fileUrl: '',
            fileName: '',
            fileSize: 0,
            publicId: '',
            mediaResourceType: '',
            type: 'text',
        };

        if (req.file) {
            const isDocumentMode = req.body.type === 'document';
            const isAudioMode = req.body.type === 'audio' || req.file.mimetype.startsWith('audio/');
            const resourceType = isDocumentMode ? 'raw' : isAudioMode ? 'video' : 'auto';

            const result = await uploadFile(req.file.path, 'vibely/messages', resourceType);

            fileData = {
                fileUrl: result.url,
                fileName: req.file.originalname,
                fileSize: result.bytes || req.file.size,
                publicId: result.publicId,
                mediaResourceType: result.resourceType || getMediaResourceType(isAudioMode ? 'audio' : isDocumentMode ? 'document' : 'image'),
                type: 'document',
            };

            if (isAudioMode) {
                fileData.type = 'audio';
            } else if (!isDocumentMode && (result.resourceType === 'image' || req.file.mimetype.startsWith('image/'))) {
                fileData.type = 'image';
            } else if (!isDocumentMode && (result.resourceType === 'video' || req.file.mimetype.startsWith('video/'))) {
                fileData.type = 'video';
            }
        }

        const viewOnce = parseViewOncePayload(req.body, fileData.type);
        if (viewOnce.requested && !viewOnce.config.enabled) {
            return res.status(400).json({ error: 'View-once is only available for photos and videos' });
        }

        if (!normalizedText && !fileData.fileUrl) {
            return res.status(400).json({ error: 'Message must have text or media' });
        }

        const scheduledMessage = await ScheduledMessage.create({
            chatId,
            senderId: req.userId,
            text: normalizedText,
            replyTo: replyMessage?._id || null,
            ...fileData,
            viewOnce: {
                enabled: viewOnce.config.enabled,
                durationSeconds: viewOnce.config.durationSeconds,
            },
            scheduledFor: deliveryAt,
        });

        const populatedScheduledMessage = await populateScheduledMessage(scheduledMessage._id);
        res.status(201).json({ scheduledMessage: populatedScheduledMessage });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    } finally {
        cleanupTempFile(req.file?.path);
    }
};

// GET /api/messages/scheduled/:chatId - Get scheduled messages for current user in a chat
exports.getScheduledMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        await ensureChatParticipant(chatId, req.userId);

        const scheduledMessages = await ScheduledMessage.find({
            chatId,
            senderId: req.userId,
        })
            .sort({ scheduledFor: 1, createdAt: 1 })
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate({
                path: 'replyTo',
                select: `${REPLY_PREVIEW_FIELDS} senderId`,
                populate: {
                    path: 'senderId',
                    select: MESSAGE_SENDER_FIELDS,
                },
            });

        res.json({ scheduledMessages: scheduledMessages.map((message) => sanitizeMessageForViewer(message, req.userId)) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// DELETE /api/messages/scheduled/:id - Delete a scheduled message
exports.deleteScheduledMessage = async (req, res) => {
    try {
        const scheduledMessage = await ScheduledMessage.findOne({
            _id: req.params.id,
            senderId: req.userId,
        });

        if (!scheduledMessage) {
            return res.status(404).json({ error: 'Scheduled message not found' });
        }

        if (scheduledMessage.publicId) {
            await deleteImage(
                scheduledMessage.publicId,
                scheduledMessage.mediaResourceType || getMediaResourceType(scheduledMessage.type)
            );
        }

        await ScheduledMessage.findByIdAndDelete(scheduledMessage._id);
        res.json({ success: true, scheduledMessageId: scheduledMessage._id, chatId: scheduledMessage.chatId });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PATCH /api/messages/scheduled/:id - Update text and delivery time for a scheduled message
exports.updateScheduledMessage = async (req, res) => {
    try {
        const scheduledMessage = await ScheduledMessage.findOne({
            _id: req.params.id,
            senderId: req.userId,
        });

        if (!scheduledMessage) {
            return res.status(404).json({ error: 'Scheduled message not found' });
        }

        await ensureChatAccessForMessages(scheduledMessage.chatId, req.userId);

        if (typeof req.body.text === 'string') {
            scheduledMessage.text = req.body.text.trim();
        }

        if (req.body.scheduledFor) {
            const deliveryAt = new Date(req.body.scheduledFor);
            if (Number.isNaN(deliveryAt.getTime())) {
                return res.status(400).json({ error: 'Choose a valid delivery time' });
            }
            if (deliveryAt.getTime() <= Date.now() + 15000) {
                return res.status(400).json({ error: 'Scheduled time must be in the future' });
            }
            scheduledMessage.scheduledFor = deliveryAt;
        }

        if (!scheduledMessage.text && !scheduledMessage.fileUrl) {
            return res.status(400).json({ error: 'Message must have text or media' });
        }

        await scheduledMessage.save();
        const populatedScheduledMessage = await populateScheduledMessage(scheduledMessage._id);
        res.json({ scheduledMessage: populatedScheduledMessage });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/messages/pins/:chatId - Get pinned messages for a chat
exports.getPinnedMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        await ensureChatParticipant(chatId, req.userId);

        const pinnedMessages = await Message.find({
            chatId,
            isPinned: true,
            isDeleted: { $ne: true },
            deletedFor: { $ne: req.userId },
        })
            .sort({ pinnedAt: -1, createdAt: -1 })
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate('reactions.userId', 'name')
            .populate({
                path: 'replyTo',
                select: `${REPLY_PREVIEW_FIELDS} senderId`,
                populate: {
                    path: 'senderId',
                    select: MESSAGE_SENDER_FIELDS,
                },
            });

        res.json({ pinnedMessages: sanitizeMessagesForViewer(pinnedMessages, req.userId) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// PATCH /api/messages/seen - Mark messages as seen
exports.markAsSeen = async (req, res) => {
    try {
        const { chatId } = req.body;
        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Message.updateMany(
            {
                chatId,
                senderId: { $ne: req.userId },
                status: { $ne: 'seen' },
            },
            { status: 'seen' }
        );

        // Reset unread count
        chat.unreadCount.set(req.userId.toString(), 0);
        await chat.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PATCH /api/messages/:id - Edit message
exports.editMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.senderId.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Can only edit your own messages' });
        }

        // Can only edit within 15 minutes
        const fifteenMinutes = 15 * 60 * 1000;
        if (Date.now() - message.createdAt.getTime() > fifteenMinutes) {
            return res.status(400).json({ error: 'Can only edit messages within 15 minutes' });
        }

        message.text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        message.isEdited = true;
        await message.save();

        const populated = await Message.findById(message._id).populate('senderId', MESSAGE_SENDER_FIELDS);
        res.json({ message: populated });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// DELETE /api/messages/:id - Delete message
exports.deleteMessage = async (req, res) => {
    try {
        const { type } = req.query; // 'me' or 'everyone'
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (type === 'everyone') {
            if (message.senderId.toString() !== req.userId.toString()) {
                return res.status(403).json({ error: 'Can only delete your own messages for everyone' });
            }
            message.isDeleted = true;
            message.text = '';
            message.fileUrl = '';
            message.fileName = '';
            message.fileSize = 0;
            message.publicId = '';
            message.mediaResourceType = '';
            message.poll = { question: '', options: [] };
            message.viewOnce = { enabled: false, durationSeconds: 10, views: [] };
            message.isPinned = false;
            message.pinnedAt = null;
            message.pinnedBy = null;
            await message.save();
        } else {
            // Delete for me (default)
            if (!message.deletedFor.includes(req.userId)) {
                message.deletedFor.push(req.userId);
                await message.save();
            }
        }

        res.json({ success: true, messageId: message._id, type: type || 'me' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.openViewOnceMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message || message.isDeleted || message.deletedFor?.some((entry) => sameId(entry, req.userId))) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (!message.viewOnce?.enabled || !['image', 'video'].includes(message.type)) {
            return res.status(400).json({ error: 'This message is not protected media' });
        }

        const chat = await ensureChatParticipant(message.chatId, req.userId);
        const isSender = sameId(message.senderId, req.userId);

        if (!isSender && hasViewedViewOnce(message, req.userId)) {
            return res.status(410).json({ error: 'This media has already been viewed' });
        }

        if (!isSender) {
            message.viewOnce.views.push({
                userId: req.userId,
                viewedAt: new Date(),
            });
            await message.save();
        }

        const populatedMessage = await populateMessage(message._id);
        emitToChatParticipants(req, chat, 'messageUpdated', (viewerId) => ({
            message: sanitizeMessageForViewer(populatedMessage, viewerId),
        }), null);

        res.json({
            mediaUrl: message.fileUrl,
            type: message.type,
            durationSeconds: message.viewOnce?.durationSeconds || 10,
            message: sanitizeMessageForViewer(populatedMessage, req.userId),
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// POST /api/messages/:id/react - Add reaction
exports.addReaction = async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const chat = await Chat.findOne({
            _id: message.chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const existingReaction = message.reactions.find(
            (r) => r.userId.toString() === req.userId.toString()
        );

        if (existingReaction?.emoji === emoji) {
            message.reactions = message.reactions.filter(
                (r) => r.userId.toString() !== req.userId.toString()
            );
        } else {
            message.reactions = message.reactions.filter(
                (r) => r.userId.toString() !== req.userId.toString()
            );
            message.reactions.push({ userId: req.userId, emoji });
        }

        await message.save();

        const populated = await Message.findById(message._id)
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate('reactions.userId', 'name');

        res.json({ message: sanitizeMessageForViewer(populated, req.userId) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/messages/:id/star - Toggle starred message for current user
exports.toggleStar = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const chat = await Chat.findOne({
            _id: message.chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const isStarred = message.starredBy?.some((id) => id.toString() === req.userId.toString());
        if (isStarred) {
            message.starredBy = message.starredBy.filter((id) => id.toString() !== req.userId.toString());
        } else {
            message.starredBy.push(req.userId);
        }

        await message.save();
        const populatedMessage = await populateMessage(message._id);

        res.json({ message: sanitizeMessageForViewer(populatedMessage, req.userId), starred: !isStarred });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/messages/:id/pin - Toggle pinned state for a message
exports.togglePinMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (message.isDeleted || message.deletedFor?.some((entry) => entry.toString() === req.userId.toString())) {
            return res.status(400).json({ error: 'Deleted messages cannot be pinned' });
        }
        if (message.viewOnce?.enabled) {
            return res.status(400).json({ error: 'View-once media cannot be pinned' });
        }

        const chat = await ensureChatParticipant(message.chatId, req.userId);
        ensureCanPinMessage(chat, req.userId);

        const nextPinnedState = !message.isPinned;
        message.isPinned = nextPinnedState;
        message.pinnedAt = nextPinnedState ? new Date() : null;
        message.pinnedBy = nextPinnedState ? req.userId : null;
        await message.save();

        const populatedMessage = await populateMessage(message._id);
        const io = req.app.get('io');

        if (io) {
            emitToChatParticipants(io, chat, 'messageUpdated', (viewerId) => ({
                message: sanitizeMessageForViewer(populatedMessage, viewerId),
            }), null);
        }

        res.json({ message: sanitizeMessageForViewer(populatedMessage, req.userId), pinned: nextPinnedState });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// POST /api/messages/:id/forward - Forward a message to another chat
exports.forwardMessage = async (req, res) => {
    try {
        const { chatId } = req.body;
        const originalMessage = await Message.findById(req.params.id).populate('senderId', MESSAGE_SENDER_FIELDS);

        if (!originalMessage || originalMessage.isDeleted) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const sourceChat = await Chat.findOne({
            _id: originalMessage.chatId,
            participants: req.userId,
        });

        if (!sourceChat) {
            return res.status(403).json({ error: 'Access denied' });
        }
        if (originalMessage.viewOnce?.enabled) {
            return res.status(400).json({ error: 'View-once media cannot be forwarded' });
        }

        const targetChat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
        });

        if (!targetChat) {
            return res.status(403).json({ error: 'Cannot forward to this chat' });
        }

        ensureDirectChatCanSend(targetChat, req.userId);

        const message = await Message.create({
            chatId,
            senderId: req.userId,
            text: originalMessage.text,
            type: originalMessage.type,
            fileUrl: originalMessage.fileUrl,
            fileName: originalMessage.fileName,
            fileSize: originalMessage.fileSize,
            publicId: originalMessage.publicId,
            mediaResourceType: originalMessage.mediaResourceType || (originalMessage.publicId ? getMediaResourceType(originalMessage.type) : ''),
            poll: originalMessage.type === 'poll'
                ? {
                    question: originalMessage.poll?.question || '',
                    options: (originalMessage.poll?.options || []).map((option) => ({
                        optionId: randomUUID(),
                        text: option.text,
                        votes: [],
                    })),
                }
                : { question: '', options: [] },
            forwardedFrom: {
                messageId: originalMessage._id,
                senderName: originalMessage.forwardedFrom?.senderName || originalMessage.senderId?.name || 'Unknown',
            },
            status: 'sent',
        });

        await updateChatAfterMessage(targetChat, req.userId, message._id);
        const populatedMessage = await populateMessage(message._id);

        emitToChatParticipants(req, targetChat, 'receiveMessage', (viewerId) => ({
            message: sanitizeMessageForViewer(populatedMessage, viewerId),
            chatId,
        }), req.userId);

        res.status(201).json({ message: sanitizeMessageForViewer(populatedMessage, req.userId) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

// POST /api/messages/poll - Create a poll in a group chat
exports.createPoll = async (req, res) => {
    try {
        const { chatId, question, options = [] } = req.body;

        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
            isGroup: true,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Only group members can create polls' });
        }

        const normalizedQuestion = question?.trim();
        const normalizedOptions = options
            .map((option) => option?.trim())
            .filter(Boolean)
            .slice(0, 10);

        if (!normalizedQuestion) {
            return res.status(400).json({ error: 'Poll question is required' });
        }

        if (normalizedOptions.length < 2) {
            return res.status(400).json({ error: 'Add at least two poll options' });
        }

        const message = await Message.create({
            chatId,
            senderId: req.userId,
            type: 'poll',
            poll: {
                question: normalizedQuestion,
                options: normalizedOptions.map((option) => ({
                    optionId: randomUUID(),
                    text: option,
                    votes: [],
                })),
            },
            status: 'sent',
        });

        await updateChatAfterMessage(chat, req.userId, message._id);
        const populatedMessage = await populateMessage(message._id);

        emitToChatParticipants(req, chat, 'receiveMessage', {
            message: populatedMessage,
            chatId,
        }, req.userId);

        res.status(201).json({ message: populatedMessage });
    } catch (error) {
        console.error('Create poll error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/messages/poll/:id/vote - Vote on a poll
exports.votePoll = async (req, res) => {
    try {
        const { optionId } = req.body;
        const message = await Message.findById(req.params.id);

        if (!message || message.type !== 'poll') {
            return res.status(404).json({ error: 'Poll not found' });
        }

        const chat = await Chat.findOne({
            _id: message.chatId,
            participants: req.userId,
            isGroup: true,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const selectedOption = message.poll.options.find((option) => option.optionId === optionId);
        if (!selectedOption) {
            return res.status(400).json({ error: 'Invalid poll option' });
        }

        message.poll.options.forEach((option) => {
            option.votes = option.votes.filter((vote) => vote.toString() !== req.userId.toString());
        });
        selectedOption.votes.push(req.userId);

        await message.save();

        const populatedMessage = await populateMessage(message._id);
        emitToChatParticipants(req, chat, 'messageUpdated', { message: populatedMessage }, null);

        res.json({ message: populatedMessage });
    } catch (error) {
        console.error('Vote poll error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
