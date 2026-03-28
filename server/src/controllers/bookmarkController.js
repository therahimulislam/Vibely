// server/src/controllers/bookmarkController.js
// Bookmark collection management

const BookmarkCollection = require('../models/BookmarkCollection');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { sanitizeMessageForViewer } = require('../utils/messageVisibility');

const MESSAGE_SENDER_FIELDS = 'name avatar username';
const sanitizeColor = (value = '') => {
    const trimmed = value.trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : '#6f6bff';
};

const ensureMessageAccess = async (messageId, userId) => {
    const message = await Message.findById(messageId);
    if (!message || message.isDeleted || message.deletedFor?.some((entry) => entry.toString() === userId.toString())) {
        throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }

    const chat = await Chat.findOne({
        _id: message.chatId,
        participants: userId,
    });

    if (!chat) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    return message;
};

const populateCollections = (query) => query.populate({
    path: 'items.messageId',
    populate: [
        { path: 'senderId', select: MESSAGE_SENDER_FIELDS },
        {
            path: 'chatId',
            select: 'isGroup isSavedMessages groupName groupAvatar participants',
            populate: {
                path: 'participants',
                select: MESSAGE_SENDER_FIELDS,
            },
        },
    ],
});

const normalizeCollection = (collection, userId) => {
    const plain = collection.toObject();
    return {
        ...plain,
        items: (plain.items || [])
            .filter((item) => item.messageId)
            .map((item) => ({
                ...item,
                messageId: sanitizeMessageForViewer(item.messageId, userId),
            }))
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)),
    };
};

exports.getCollections = async (req, res) => {
    try {
        const collections = await populateCollections(
            BookmarkCollection.find({ userId: req.userId }).sort({ updatedAt: -1, createdAt: -1 })
        );

        res.json({ collections: collections.map((collection) => normalizeCollection(collection, req.userId)) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createCollection = async (req, res) => {
    try {
        const name = `${req.body.name || ''}`.trim().slice(0, 32);
        if (!name) {
            return res.status(400).json({ error: 'Collection name is required' });
        }

        const collection = await BookmarkCollection.create({
            userId: req.userId,
            name,
            color: sanitizeColor(`${req.body.color || '#6f6bff'}`),
        });

        const populatedCollection = await populateCollections(BookmarkCollection.findById(collection._id));
        res.status(201).json({ collection: normalizeCollection(populatedCollection, req.userId) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCollection = async (req, res) => {
    try {
        const collection = await BookmarkCollection.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        if (typeof req.body.name === 'string') {
            const name = req.body.name.trim().slice(0, 32);
            if (!name) {
                return res.status(400).json({ error: 'Collection name is required' });
            }
            collection.name = name;
        }

        if (typeof req.body.color === 'string') {
            collection.color = sanitizeColor(req.body.color);
        }

        await collection.save();
        const populatedCollection = await populateCollections(BookmarkCollection.findById(collection._id));
        res.json({ collection: normalizeCollection(populatedCollection, req.userId) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteCollection = async (req, res) => {
    try {
        const collection = await BookmarkCollection.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ success: true, collectionId: collection._id });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.toggleCollectionMessage = async (req, res) => {
    try {
        const { messageId } = req.body;
        if (!messageId) {
            return res.status(400).json({ error: 'Message ID is required' });
        }

        await ensureMessageAccess(messageId, req.userId);

        const collection = await BookmarkCollection.findOne({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const existingItem = collection.items.find((item) => item.messageId.toString() === messageId.toString());
        let saved = false;

        if (existingItem) {
            collection.items = collection.items.filter((item) => item.messageId.toString() !== messageId.toString());
        } else {
            collection.items.unshift({ messageId, addedAt: new Date() });
            saved = true;
        }

        await collection.save();
        const populatedCollection = await populateCollections(BookmarkCollection.findById(collection._id));

        res.json({
            collection: normalizeCollection(populatedCollection, req.userId),
            saved,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};
