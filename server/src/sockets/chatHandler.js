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
    socket.on('typing', ({ chatId, recipientId }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('userTyping', {
                chatId,
                userId: socket.userId,
            });
        }
    });

    // Stop typing
    socket.on('stopTyping', ({ chatId, recipientId }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('userStopTyping', {
                chatId,
                userId: socket.userId,
            });
        }
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

    // Message reaction
    socket.on('messageReaction', async ({ messageId, emoji, recipientId }) => {
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
                // Remove any existing reaction from this user first
                message.reactions = message.reactions.filter(
                    (r) => r.userId.toString() !== socket.userId
                );
                message.reactions.push({ userId: socket.userId, emoji });
            }

            await message.save();

            const populated = await Message.findById(messageId)
                .populate('senderId', 'name avatar')
                .populate('reactions.userId', 'name');

            // Notify both users
            socket.emit('messageUpdated', { message: populated });
            const recipientSocketId = onlineUsers.get(recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('messageUpdated', { message: populated });
            }
        } catch (error) {
            console.error('Reaction error:', error);
        }
    });

    // Message delete
    socket.on('deleteMessage', async ({ messageId, chatId, recipientId, type }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (type === 'everyone') {
                if (message.senderId.toString() !== socket.userId) return;

                message.isDeleted = true;
                message.text = '';
                message.imageUrl = '';
                message.videoUrl = '';
                await message.save();

                const recipientSocketId = onlineUsers.get(recipientId);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('messageDeleted', { messageId, chatId, type: 'everyone' });
                }
                socket.emit('messageDeleted', { messageId, chatId, type: 'everyone' });
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
    socket.on('editMessage', async ({ messageId, text, recipientId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || message.senderId.toString() !== socket.userId) return;

            message.text = text;
            message.isEdited = true;
            await message.save();

            const populated = await Message.findById(messageId).populate('senderId', 'name avatar');

            const recipientSocketId = onlineUsers.get(recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('messageUpdated', { message: populated });
            }
            socket.emit('messageUpdated', { message: populated });
        } catch (error) {
            console.error('Edit error:', error);
        }
    });
};
