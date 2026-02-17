// server/src/controllers/messageController.js
// Message controller - send, retrieve, edit, delete, react

const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { uploadFile } = require('../services/cloudinaryService');
const fs = require('fs');

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

        const messages = await Message.find({
            chatId,
            deletedFor: { $ne: req.userId }, // Exclude deleted-for-me messages
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('senderId', 'name avatar')
            .populate('reactions.userId', 'name');

        const total = await Message.countDocuments({ chatId });

        res.json({
            messages: messages.reverse(),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: skip + limit < total,
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
        let imageUrl = '';
        let videoUrl = '';

        // Verify user is participant
        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.userId,
        });

        if (!chat) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Handle file upload
        let fileData = {
            fileUrl: '',
            fileName: '',
            fileSize: 0,
            publicId: '',
            type: 'text',
        };

        if (req.file) {
            const result = await uploadFile(req.file.path);

            fileData = {
                fileUrl: result.url,
                fileName: req.file.originalname,
                fileSize: result.bytes || req.file.size,
                publicId: result.publicId,
                type: 'document', // Default to document
            };

            // Determine specific type based on Cloudinary resource_type or mimetype
            if (result.resource_type === 'image' || req.file.mimetype.startsWith('image/')) {
                fileData.type = 'image';
            } else if (result.resource_type === 'video' || req.file.mimetype.startsWith('video/')) {
                fileData.type = 'video';
            }

            // Cleanup
            fs.unlink(req.file.path, () => { });
        }

        if (!text && !fileData.fileUrl) {
            return res.status(400).json({ error: 'Message must have text or media' });
        }

        const message = await Message.create({
            chatId,
            senderId: req.userId,
            text: text || '',
            ...fileData,
            status: 'sent',
        });

        // Update chat's last message
        chat.lastMessage = message._id;
        chat.updatedAt = new Date();

        // Increment unread count for other participants
        chat.participants.forEach((pId) => {
            if (pId.toString() !== req.userId.toString()) {
                const currentCount = chat.unreadCount.get(pId.toString()) || 0;
                chat.unreadCount.set(pId.toString(), currentCount + 1);
            }
        });

        await chat.save();

        const populatedMessage = await Message.findById(message._id).populate('senderId', 'name avatar');

        res.status(201).json({ message: populatedMessage });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// PATCH /api/messages/seen - Mark messages as seen
exports.markAsSeen = async (req, res) => {
    try {
        const { chatId } = req.body;

        await Message.updateMany(
            {
                chatId,
                senderId: { $ne: req.userId },
                status: { $ne: 'seen' },
            },
            { status: 'seen' }
        );

        // Reset unread count
        const chat = await Chat.findById(chatId);
        if (chat) {
            chat.unreadCount.set(req.userId.toString(), 0);
            await chat.save();
        }

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

        message.text = req.body.text;
        message.isEdited = true;
        await message.save();

        const populated = await Message.findById(message._id).populate('senderId', 'name avatar');
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
            message.imageUrl = '';
            message.videoUrl = '';
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

        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(
            (r) => r.userId.toString() !== req.userId.toString()
        );

        // Add new reaction (or toggle off if same emoji)
        const existingReaction = message.reactions.find(
            (r) => r.userId.toString() === req.userId.toString() && r.emoji === emoji
        );

        if (!existingReaction) {
            message.reactions.push({ userId: req.userId, emoji });
        }

        await message.save();

        const populated = await Message.findById(message._id)
            .populate('senderId', 'name avatar')
            .populate('reactions.userId', 'name');

        res.json({ message: populated });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
