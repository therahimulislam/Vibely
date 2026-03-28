// server/src/services/cronService.js
// Cron jobs for retention policies

const cron = require('node-cron');
const Message = require('../models/Message');
const ScheduledMessage = require('../models/ScheduledMessage');
const Reminder = require('../models/Reminder');
const Chat = require('../models/Chat');
const Status = require('../models/Status');
const { deleteImage } = require('./cloudinaryService');
const { sanitizeMessageForViewer } = require('../utils/messageVisibility');
const { ensureCanPostInGroup, getMessageExpiryForChat } = require('../utils/chatRules');

const MESSAGE_SENDER_FIELDS = 'name avatar username';
const REPLY_PREVIEW_FIELDS = 'text type fileUrl fileName createdAt isDeleted poll forwardedFrom';
const getMediaResourceType = (messageType = 'image', explicitType = '') => {
    if (explicitType) return explicitType;
    if (messageType === 'document') return 'raw';
    if (messageType === 'video' || messageType === 'audio') return 'video';
    return 'image';
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

const populateReminder = (reminderId) => Reminder.findById(reminderId).populate({
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

const canDeliverScheduledMessage = async (chat, senderId, messageType = 'text') => {
    if (!chat || !chat.participants.some((participantId) => participantId.toString() === senderId.toString())) {
        return false;
    }

    if (!chat.isGroup && chat.requestStatus === 'rejected') {
        return false;
    }

    if (!chat.isGroup && chat.requestStatus === 'pending' && chat.requestedBy?.toString() !== senderId.toString()) {
        return false;
    }

    if (chat.isGroup) {
        try {
            await ensureCanPostInGroup(chat, senderId, {
                messageType,
                skipSlowMode: true,
            });
        } catch (error) {
            return false;
        }
    }

    return true;
};

const emitScheduledMessage = (io, chat, message, senderId, scheduledMessageId) => {
    if (!io) return;

    io.to(`user:${senderId}`).emit('messageSent', {
        message,
        chatId: chat._id.toString(),
        scheduledMessageId,
    });

    chat.participants.forEach((participantId) => {
        const recipientId = participantId.toString();
        if (recipientId === senderId.toString()) return;

        io.to(`user:${recipientId}`).emit('receiveMessage', {
            message: sanitizeMessageForViewer(message, recipientId),
            chatId: chat._id.toString(),
        });
    });
};

const dispatchDueReminders = async (io) => {
    const now = new Date();
    const reminders = await Reminder.find({
        status: 'scheduled',
        remindAt: { $lte: now },
    })
        .sort({ remindAt: 1, createdAt: 1 })
        .limit(50);

    for (const reminder of reminders) {
        try {
            reminder.status = 'triggered';
            reminder.triggeredAt = now;
            await reminder.save();

            const populatedReminder = await populateReminder(reminder._id);
            if (!populatedReminder?.messageId) {
                await Reminder.findByIdAndDelete(reminder._id);
                continue;
            }

            io?.to(`user:${reminder.userId}`).emit('reminderDue', {
                reminder: normalizeReminder(populatedReminder, reminder.userId),
            });
        } catch (error) {
            console.error('❌ Reminder delivery error:', error);
        }
    }
};

const dispatchDueScheduledMessages = async (io) => {
    const now = new Date();
    const dueMessages = await ScheduledMessage.find({
        scheduledFor: { $lte: now },
    })
        .sort({ scheduledFor: 1, createdAt: 1 })
        .limit(50);

    for (const scheduledMessage of dueMessages) {
        try {
            const chat = await Chat.findById(scheduledMessage.chatId);

            if (!(await canDeliverScheduledMessage(chat, scheduledMessage.senderId, scheduledMessage.type))) {
                if (scheduledMessage.publicId) {
                    await deleteImage(
                        scheduledMessage.publicId,
                        getMediaResourceType(scheduledMessage.type, scheduledMessage.mediaResourceType)
                    );
                }
                await ScheduledMessage.findByIdAndDelete(scheduledMessage._id);
                continue;
            }

            const message = await Message.create({
                chatId: scheduledMessage.chatId,
                senderId: scheduledMessage.senderId,
                text: scheduledMessage.text,
                replyTo: scheduledMessage.replyTo,
                type: scheduledMessage.type,
                fileUrl: scheduledMessage.fileUrl,
                fileName: scheduledMessage.fileName,
                fileSize: scheduledMessage.fileSize,
                publicId: scheduledMessage.publicId,
                mediaResourceType: scheduledMessage.mediaResourceType,
                viewOnce: {
                    enabled: !!scheduledMessage.viewOnce?.enabled,
                    durationSeconds: scheduledMessage.viewOnce?.durationSeconds || 10,
                    views: [],
                },
                expiresAt: getMessageExpiryForChat(chat),
                status: 'sent',
            });

            chat.lastMessage = message._id;
            chat.updatedAt = new Date();
            chat.deletedBy = [];
            chat.archivedBy = [];

            chat.participants.forEach((participantId) => {
                if (participantId.toString() !== scheduledMessage.senderId.toString()) {
                    const currentUnreadCount = chat.unreadCount.get(participantId.toString()) || 0;
                    chat.unreadCount.set(participantId.toString(), currentUnreadCount + 1);
                }
            });

            await chat.save();
            await ScheduledMessage.findByIdAndDelete(scheduledMessage._id);

            const populatedMessage = await populateMessage(message._id);
            emitScheduledMessage(io, chat, populatedMessage, scheduledMessage.senderId, scheduledMessage._id.toString());
        } catch (error) {
            console.error('❌ Scheduled message delivery error:', error);
        }
    }
};

const initCronJobs = (io) => {
    cron.schedule('* * * * *', async () => {
        try {
            await dispatchDueScheduledMessages(io);
            await dispatchDueReminders(io);
        } catch (error) {
            console.error('❌ Scheduled delivery/reminder cron error:', error);
        }
    });

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Running retention cron job...');
        try {
            const now = new Date();

            const expiredStatuses = await Status.find({
                expiresAt: { $lt: now }
            });

            if (expiredStatuses.length > 0) {
                console.log(`Found ${expiredStatuses.length} expired statuses`);
                for (const status of expiredStatuses) {
                    if (status.publicId) {
                        await deleteImage(status.publicId, status.mediaResourceType || 'image');
                    }
                    await Status.findByIdAndDelete(status._id);
                }
            }

            const expiredMessages = await Message.find({
                expiresAt: { $ne: null, $lte: now },
            });

            if (expiredMessages.length > 0) {
                console.log(`Found ${expiredMessages.length} expired disappearing messages`);
                for (const msg of expiredMessages) {
                    if (msg.publicId) {
                        await deleteImage(msg.publicId, getMediaResourceType(msg.type, msg.mediaResourceType));
                    }
                    await Message.findByIdAndDelete(msg._id);
                }
            }

        } catch (error) {
            console.error('❌ Retention cron job error:', error);
        }
    });

    console.log('✅ Retention, scheduled delivery, and reminder cron jobs initialized');
};

module.exports = { initCronJobs };
