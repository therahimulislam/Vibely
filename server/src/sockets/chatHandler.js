// server/src/sockets/chatHandler.js
// Real-time chat event handlers

const Message = require('../models/Message');
const Chat = require('../models/Chat');

module.exports = (io, socket, onlineUsers) => {
    // Send message in real-time
    socket.on('sendMessage', async (data) => {
        try {
            const { chatId, text, imageUrl, videoUrl, tempId } = data;

            // Create message
            const message = await Message.create({
                chatId,
                senderId: socket.userId,
                text: text || '',
                imageUrl: imageUrl || '',
                videoUrl: videoUrl || '',
                status: 'sent',
            });

            // Update chat
            const chat = await Chat.findById(chatId);
            if (chat) {
                chat.lastMessage = message._id;
                chat.updatedAt = new Date();

                chat.participants.forEach((pId) => {
                    if (pId.toString() !== socket.userId) {
                        const count = chat.unreadCount.get(pId.toString()) || 0;
                        chat.unreadCount.set(pId.toString(), count + 1);
                    }
                });

                await chat.save();
            }

            const populated = await Message.findById(message._id).populate('senderId', 'name avatar');

            // Send to all participants in the chat
            if (chat) {
                chat.participants.forEach((pId) => {
                    const recipientId = pId.toString();
                    if (recipientId !== socket.userId) {
                        const recipientSocketId = onlineUsers.get(recipientId);
                        if (recipientSocketId) {
                            // Deliver to online recipient
                            io.to(recipientSocketId).emit('receiveMessage', {
                                message: populated,
                                chatId,
                            });

                            // Mark as delivered
                            message.status = 'delivered';
                            message.save();
                        }
                    }
                });
            }

            // Confirm to sender
            socket.emit('messageSent', {
                message: populated,
                tempId,
                chatId,
            });
        } catch (error) {
            socket.emit('messageError', { error: error.message });
        }
    });

    // Typing indicator
    socket.on('typing', ({ chatId }) => {
        notifyChatParticipants(chatId, 'userTyping', {
            chatId,
            userId: socket.userId,
        }, socket.userId);
    });

    // Stop typing
    socket.on('stopTyping', ({ chatId }) => {
        notifyChatParticipants(chatId, 'userStopTyping', {
            chatId,
            userId: socket.userId,
        }, socket.userId);
    });

    // Message seen
    socket.on('messageSeen', async ({ chatId, senderId }) => {
        try {
            // Update all unseen messages from sender in this chat
            await Message.updateMany(
                {
                    chatId,
                    senderId,
                    status: { $ne: 'seen' },
                },
                { status: 'seen' }
            );

            // Reset unread count
            const chat = await Chat.findById(chatId);
            if (chat) {
                chat.unreadCount.set(socket.userId, 0);
                await chat.save();
            }

            // Notify sender that messages were seen
            const senderSocketId = onlineUsers.get(senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit('messagesSeen', {
                    chatId,
                    seenBy: socket.userId,
                });
            }
        } catch (error) {
            console.error('Message seen error:', error);
        }
    });

    // Helper to notify all participants
    const notifyChatParticipants = async (chatId, eventName, data, socketUserId) => {
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        chat.participants.forEach((pId) => {
            const recipientId = pId.toString();
            if (recipientId !== socketUserId) {
                const recipientSocketId = onlineUsers.get(recipientId);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit(eventName, data);
                }
            }
        });
    };

    // Message reaction
    socket.on('messageReaction', async ({ messageId, emoji }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            // Toggle reaction
            const existingIndex = message.reactions.findIndex(
                (r) => r.userId.toString() === socket.userId && r.emoji === emoji
            );

            if (existingIndex > -1) {
                message.reactions.splice(existingIndex, 1);
            } else {
                message.reactions = message.reactions.filter(
                    (r) => r.userId.toString() !== socket.userId
                );
                message.reactions.push({ userId: socket.userId, emoji });
            }

            await message.save();

            const populated = await Message.findById(messageId)
                .populate('senderId', 'name avatar')
                .populate('reactions.userId', 'name');

            // Notify sender
            socket.emit('messageUpdated', { message: populated });

            // Notify others
            await notifyChatParticipants(message.chatId, 'messageUpdated', { message: populated }, socket.userId);

        } catch (error) {
            console.error('Reaction error:', error);
        }
    });

    // Message delete
    socket.on('deleteMessage', async ({ messageId, chatId, type }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (type === 'everyone') {
                if (message.senderId.toString() !== socket.userId) return;

                message.isDeleted = true;
                message.text = '';
                message.imageUrl = '';
                message.videoUrl = '';
                message.fileUrl = ''; // Also clear file
                await message.save();

                socket.emit('messageDeleted', { messageId, chatId, type: 'everyone' });
                await notifyChatParticipants(chatId, 'messageDeleted', { messageId, chatId, type: 'everyone' }, socket.userId);
            } else {
                // Delete for me
                if (!message.deletedFor.includes(socket.userId)) {
                    message.deletedFor.push(socket.userId);
                    await message.save();
                }
                socket.emit('messageDeleted', { messageId, chatId, type: 'me' });
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    });

    // Message edit
    socket.on('editMessage', async ({ messageId, text }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || message.senderId.toString() !== socket.userId) return;

            message.text = text;
            message.isEdited = true;
            await message.save();

            const populated = await Message.findById(messageId).populate('senderId', 'name avatar');

            socket.emit('messageUpdated', { message: populated });
            await notifyChatParticipants(message.chatId, 'messageUpdated', { message: populated }, socket.userId);
        } catch (error) {
            console.error('Edit error:', error);
        }
    });
};
