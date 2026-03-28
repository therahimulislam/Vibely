// Real-time chat event handlers

const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { sanitizeMessageForViewer } = require('../utils/messageVisibility');
const { ensureCanPostInGroup, getMessageExpiryForChat } = require('../utils/chatRules');

module.exports = (io, socket, onlineUsers) => {
    const senderFields = 'name avatar username';
    const populateMessage = (messageId) => Message.findById(messageId)
        .populate('senderId', senderFields)
        .populate('reactions.userId', 'name')
        .populate({
            path: 'replyTo',
            select: 'text type fileUrl fileName createdAt isDeleted poll forwardedFrom viewOnce senderId',
            populate: {
                path: 'senderId',
                select: senderFields,
            },
        });
    const getChatForUser = async (chatId) => Chat.findOne({
        _id: chatId,
        participants: socket.userId,
    });

    const getSocketIdsForUser = (userId) => {
        const socketIds = onlineUsers.get(userId);
        return socketIds ? [...socketIds] : [];
    };

    const notifyChatParticipants = async (chatId, eventName, data, socketUserId) => {
        const chat = await getChatForUser(chatId);
        if (!chat) return;

        chat.participants.forEach((participantId) => {
            const recipientId = participantId.toString();
            if (recipientId === socketUserId) return;

            getSocketIdsForUser(recipientId).forEach((socketId) => {
                io.to(socketId).emit(eventName, typeof data === 'function' ? data(recipientId) : data);
            });
        });
    };

    const canSendInChat = (chat) => {
        if (!chat.isGroup && chat.requestStatus === 'pending' && chat.requestedBy?.toString() !== socket.userId) {
            return 'Accept this chat request before replying';
        }

        if (!chat.isGroup && chat.requestStatus === 'rejected') {
            return 'This chat request has been rejected';
        }

        return null;
    };

    socket.on('sendMessage', async (data) => {
        try {
            const { chatId, text, tempId, replyTo } = data;
            const normalizedText = typeof text === 'string' ? text.trim() : '';
            const chat = await getChatForUser(chatId);

            if (!chat) {
                socket.emit('messageError', { error: 'Access denied' });
                return;
            }

            const sendError = canSendInChat(chat);
            if (sendError) {
                socket.emit('messageError', { error: sendError });
                return;
            }

            if (!normalizedText) {
                socket.emit('messageError', { error: 'Message must have text or media' });
                return;
            }

            await ensureCanPostInGroup(chat, socket.userId, { messageType: 'text' });

            let replyMessageId = null;
            if (replyTo) {
                const replyMessage = await Message.findOne({ _id: replyTo, chatId });
                if (!replyMessage) {
                    socket.emit('messageError', { error: 'Reply target not found in this chat' });
                    return;
                }
                replyMessageId = replyMessage._id;
            }

            const message = await Message.create({
                chatId,
                senderId: socket.userId,
                text: normalizedText,
                replyTo: replyMessageId,
                expiresAt: getMessageExpiryForChat(chat),
                status: 'sent',
            });

            chat.lastMessage = message._id;
            chat.updatedAt = new Date();
            chat.archivedBy = [];

            chat.participants.forEach((participantId) => {
                if (participantId.toString() !== socket.userId) {
                    const count = chat.unreadCount.get(participantId.toString()) || 0;
                    chat.unreadCount.set(participantId.toString(), count + 1);
                }
            });

            await chat.save();

            const populated = await populateMessage(message._id);

            let delivered = false;
            chat.participants.forEach((participantId) => {
                const recipientId = participantId.toString();
                if (recipientId === socket.userId) return;

                getSocketIdsForUser(recipientId).forEach((socketId) => {
                    delivered = true;
                    io.to(socketId).emit('receiveMessage', {
                        message: sanitizeMessageForViewer(populated, recipientId),
                        chatId,
                    });
                });
            });

            if (delivered) {
                message.status = 'delivered';
                await message.save();
                populated.status = 'delivered';
            }

            socket.emit('messageSent', {
                message: populated,
                tempId,
                chatId,
            });
        } catch (error) {
            socket.emit('messageError', { error: error.message });
        }
    });

    socket.on('typing', ({ chatId }) => {
        getChatForUser(chatId).then((chat) => {
            if (!chat) return;
            if (!chat.isGroup && chat.requestStatus === 'pending' && chat.requestedBy?.toString() !== socket.userId) {
                return;
            }
            notifyChatParticipants(chatId, 'userTyping', {
                chatId,
                userId: socket.userId,
            }, socket.userId);
        });
    });

    socket.on('stopTyping', ({ chatId }) => {
        getChatForUser(chatId).then((chat) => {
            if (!chat) return;
            notifyChatParticipants(chatId, 'userStopTyping', {
                chatId,
                userId: socket.userId,
            }, socket.userId);
        });
    });

    socket.on('messageSeen', async ({ chatId, senderId }) => {
        try {
            const chat = await getChatForUser(chatId);
            if (!chat) return;

            await Message.updateMany(
                {
                    chatId,
                    senderId,
                    status: { $ne: 'seen' },
                },
                { status: 'seen' }
            );

            chat.unreadCount.set(socket.userId, 0);
            await chat.save();

            getSocketIdsForUser(senderId).forEach((socketId) => {
                io.to(socketId).emit('messagesSeen', {
                    chatId,
                    seenBy: socket.userId,
                });
            });
        } catch (error) {
            console.error('Message seen error:', error);
        }
    });

    socket.on('messageReaction', async ({ messageId, emoji }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            const chat = await getChatForUser(message.chatId);
            if (!chat) return;

            const existingIndex = message.reactions.findIndex(
                (reaction) => reaction.userId.toString() === socket.userId && reaction.emoji === emoji
            );

            if (existingIndex > -1) {
                message.reactions.splice(existingIndex, 1);
            } else {
                message.reactions = message.reactions.filter(
                    (reaction) => reaction.userId.toString() !== socket.userId
                );
                message.reactions.push({ userId: socket.userId, emoji });
            }

            await message.save();

            const populated = await populateMessage(messageId);

            socket.emit('messageUpdated', { message: sanitizeMessageForViewer(populated, socket.userId) });
            await notifyChatParticipants(message.chatId, 'messageUpdated', (viewerId) => ({
                message: sanitizeMessageForViewer(populated, viewerId),
            }), socket.userId);
        } catch (error) {
            console.error('Reaction error:', error);
        }
    });

    socket.on('deleteMessage', async ({ messageId, chatId, type }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            const activeChatId = chatId || message.chatId;
            const chat = await getChatForUser(activeChatId);
            if (!chat) return;

            if (type === 'everyone') {
                if (message.senderId.toString() !== socket.userId) return;

                message.isDeleted = true;
                message.text = '';
                message.fileUrl = '';
                message.fileName = '';
                message.fileSize = 0;
                message.publicId = '';
                message.mediaResourceType = '';
                message.viewOnce = { enabled: false, durationSeconds: 10, views: [] };
                message.isPinned = false;
                message.pinnedAt = null;
                message.pinnedBy = null;
                await message.save();

                socket.emit('messageDeleted', { messageId, chatId: activeChatId, type: 'everyone' });
                await notifyChatParticipants(activeChatId, 'messageDeleted', { messageId, chatId: activeChatId, type: 'everyone' }, socket.userId);
                return;
            }

            if (!message.deletedFor.includes(socket.userId)) {
                message.deletedFor.push(socket.userId);
                await message.save();
            }

            socket.emit('messageDeleted', { messageId, chatId: activeChatId, type: 'me' });
        } catch (error) {
            console.error('Delete error:', error);
        }
    });

    socket.on('editMessage', async ({ messageId, text }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || message.senderId.toString() !== socket.userId) return;
            if (message.expiresAt && new Date(message.expiresAt).getTime() <= Date.now()) {
                socket.emit('messageError', { error: 'Message not found' });
                return;
            }

            const chat = await getChatForUser(message.chatId);
            if (!chat) return;

            const fifteenMinutes = 15 * 60 * 1000;
            if (Date.now() - message.createdAt.getTime() > fifteenMinutes) {
                socket.emit('messageError', { error: 'Can only edit messages within 15 minutes' });
                return;
            }

            message.text = typeof text === 'string' ? text.trim() : '';
            message.isEdited = true;
            await message.save();

            const populated = await populateMessage(messageId);

            socket.emit('messageUpdated', { message: sanitizeMessageForViewer(populated, socket.userId) });
            await notifyChatParticipants(message.chatId, 'messageUpdated', (viewerId) => ({
                message: sanitizeMessageForViewer(populated, viewerId),
            }), socket.userId);
        } catch (error) {
            console.error('Edit error:', error);
        }
    });
};
