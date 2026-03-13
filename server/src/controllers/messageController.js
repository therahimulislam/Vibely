// server/src/controllers/messageController.js
// Message controller - send, retrieve, edit, delete, react

const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { uploadFile } = require('../services/cloudinaryService');
const fs = require('fs');
const { randomUUID } = require('crypto');

const MESSAGE_SENDER_FIELDS = 'name avatar username';
const cleanupTempFile = (filePath) => {
    if (filePath) {
        fs.unlink(filePath, () => { });
    }
};

const populateMessage = (messageId) => Message.findById(messageId)
    .populate('senderId', MESSAGE_SENDER_FIELDS)
    .populate('reactions.userId', 'name');

const updateChatAfterMessage = async (chat, senderId, messageId) => {
    chat.lastMessage = messageId;
    chat.updatedAt = new Date();
    chat.deletedBy = [];

    chat.participants.forEach((participantId) => {
        if (participantId.toString() !== senderId.toString()) {
            const count = chat.unreadCount.get(participantId.toString()) || 0;
            chat.unreadCount.set(participantId.toString(), count + 1);
        }
    });

    await chat.save();
};

const emitToChatParticipants = (req, chat, eventName, payload, senderId) => {
    const io = req.app.get('io');
    if (!io) return;

    chat.participants.forEach((participantId) => {
        const userId = participantId.toString();
        if (senderId && userId === senderId.toString()) return;
        io.to(`user:${userId}`).emit(eventName, payload);
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

// GET /api/messages/:chatId - Get messages with pagination
exports.getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        // Verify user is participant of this chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!chat.isGroup && chat.requestStatus === 'pending' && chat.requestedBy?.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Accept this chat request before replying' });
        }

        if (!chat.isGroup && chat.requestStatus === 'rejected') {
            return res.status(403).json({ error: 'This chat request has been rejected' });
        }

        const messages = await Message.find({
            chatId,
            deletedFor: { $ne: req.userId }, // Exclude deleted-for-me messages
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('senderId', MESSAGE_SENDER_FIELDS)
            .populate('reactions.userId', 'name');

        const visibleTotal = await Message.countDocuments({
            chatId,
            deletedFor: { $ne: req.userId },
        });

        res.json({
            messages: messages.reverse(),
            pagination: {
                page,
                limit,
                total: visibleTotal,
                pages: Math.ceil(visibleTotal / limit),
                hasMore: skip + limit < visibleTotal,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// POST /api/messages/send - Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { chatId, text } = req.body;
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        // Verify user is participant
        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        ensureDirectChatCanSend(chat, req.userId);

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
            const resourceType = isDocumentMode ? 'raw' : 'auto';

            const result = await uploadFile(req.file.path, 'vibely/messages', resourceType);

            fileData = {
                fileUrl: result.url,
                fileName: req.file.originalname,
                fileSize: result.bytes || req.file.size,
                publicId: result.publicId,
                type: 'document', // Default to document
            };

            // Determine specific type based on Cloudinary resource_type or mimetype
            if (!isDocumentMode && (result.resource_type === 'image' || req.file.mimetype.startsWith('image/'))) {
                fileData.type = 'image';
            } else if (!isDocumentMode && (result.resource_type === 'video' || req.file.mimetype.startsWith('video/'))) {
                fileData.type = 'video';
            }
            // If isDocumentMode is true, it stays 'document' (default)

        }

        if (!normalizedText && !fileData.fileUrl) {
            return res.status(400).json({ error: 'Message must have text or media' });
        }

        const message = await Message.create({
            chatId,
            senderId: req.userId,
            text: normalizedText,
            ...fileData,
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
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    } finally {
        cleanupTempFile(req.file?.path);
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
            message.poll = { question: '', options: [] };
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

        res.json({ message: populated });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
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
