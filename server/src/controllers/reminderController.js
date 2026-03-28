// server/src/controllers/reminderController.js
// Message reminder management

const Reminder = require('../models/Reminder');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { sanitizeMessageForViewer, sameId } = require('../utils/messageVisibility');

const MESSAGE_SENDER_FIELDS = 'name avatar username';

const populateReminder = (query) => query.populate({
    path: 'messageId',
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

const normalizeReminder = (reminder, userId) => {
    const plain = typeof reminder?.toObject === 'function'
        ? reminder.toObject({ depopulate: false })
        : reminder;

    return {
        ...plain,
        messageId: plain?.messageId ? sanitizeMessageForViewer(plain.messageId, userId) : null,
    };
};

const ensureMessageAccess = async (messageId, userId) => {
    const message = await Message.findById(messageId);
    if (!message || message.isDeleted || message.deletedFor?.some((entry) => sameId(entry, userId))) {
        throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }

    const chat = await Chat.findOne({
        _id: message.chatId,
        participants: userId,
    });

    if (!chat) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    return { message, chat };
};

exports.getReminders = async (req, res) => {
    try {
        const reminders = await populateReminder(
            Reminder.find({ userId: req.userId })
                .sort({ status: 1, remindAt: 1, createdAt: -1 })
                .limit(100)
        );

        res.json({
            reminders: reminders
                .filter((reminder) => reminder.messageId)
                .map((reminder) => normalizeReminder(reminder, req.userId)),
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createReminder = async (req, res) => {
    try {
        const { messageId, remindAt } = req.body;
        if (!messageId) {
            return res.status(400).json({ error: 'Message ID is required' });
        }

        const scheduledFor = new Date(remindAt);
        if (Number.isNaN(scheduledFor.getTime())) {
            return res.status(400).json({ error: 'Choose a valid reminder time' });
        }

        if (scheduledFor.getTime() <= Date.now() + 30000) {
            return res.status(400).json({ error: 'Reminder time must be in the future' });
        }

        await ensureMessageAccess(messageId, req.userId);

        const reminder = await Reminder.create({
            userId: req.userId,
            messageId,
            remindAt: scheduledFor,
            status: 'scheduled',
            triggeredAt: null,
        });

        const populatedReminder = await populateReminder(Reminder.findById(reminder._id));
        res.status(201).json({ reminder: normalizeReminder(populatedReminder, req.userId) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Server error' });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });

        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        res.json({ success: true, reminderId: reminder._id });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.populateReminder = populateReminder;
exports.normalizeReminder = normalizeReminder;
