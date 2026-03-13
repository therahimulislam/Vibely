// WebRTC signaling for direct and group audio/video calls

const Chat = require('../models/Chat');

const activeGroupCalls = new Map();

const getCallRoom = (chatId) => `call:${chatId}`;

const serializeUser = (user) => ({
    _id: user._id.toString(),
    name: user.name,
    username: user.username,
    avatar: user.avatar || '',
});

const getSocketIdsForUser = (onlineUsers, userId) => {
    const socketIds = onlineUsers.get(userId?.toString?.() || userId);
    return socketIds ? [...socketIds] : [];
};

const getGroupChat = async (chatId, userId) => Chat.findOne({
    _id: chatId,
    isGroup: true,
    participants: userId,
}).populate('participants', 'name username avatar');

const trackSocketCall = (socket, chatId) => {
    if (!socket.data.groupCalls) {
        socket.data.groupCalls = new Set();
    }
    socket.data.groupCalls.add(chatId.toString());
};

const untrackSocketCall = (socket, chatId) => {
    socket.data.groupCalls?.delete(chatId.toString());
};

const emitToUser = (io, onlineUsers, userId, eventName, payload) => {
    getSocketIdsForUser(onlineUsers, userId).forEach((socketId) => {
        io.to(socketId).emit(eventName, payload);
    });
};

const getActiveGroupCall = (chatId) => activeGroupCalls.get(chatId?.toString?.() || chatId);

const isCallParticipant = (call, userId) => !!call?.participants?.has(userId?.toString?.() || userId);

const leaveGroupCall = ({ io, socket, chatId, endedByHost = false }) => {
    const normalizedChatId = chatId?.toString?.() || chatId;
    if (!normalizedChatId) return;

    const call = activeGroupCalls.get(normalizedChatId);
    socket.leave(getCallRoom(normalizedChatId));
    untrackSocketCall(socket, normalizedChatId);

    if (!call) return;

    call.participants.delete(socket.userId);

    if (endedByHost || call.hostId === socket.userId || call.participants.size === 0) {
        io.to(getCallRoom(normalizedChatId)).emit('groupCallEnded', {
            chatId: normalizedChatId,
            endedBy: socket.userId,
        });
        activeGroupCalls.delete(normalizedChatId);
        return;
    }

    io.to(getCallRoom(normalizedChatId)).emit('groupParticipantLeft', {
        chatId: normalizedChatId,
        userId: socket.userId,
    });
};

module.exports = (io, socket, onlineUsers) => {
    socket.on('callUser', ({ recipientId, offer, callerInfo, callType = 'video' }) => {
        const recipientSocketIds = getSocketIdsForUser(onlineUsers, recipientId);
        if (recipientSocketIds.length === 0) {
            socket.emit('callError', { error: 'User is offline' });
            return;
        }

        recipientSocketIds.forEach((socketId) => {
            io.to(socketId).emit('incomingCall', {
                callerId: socket.userId,
                callerInfo,
                offer,
                callType,
                isGroupCall: false,
            });
        });
    });

    socket.on('answerCall', ({ callerId, answer }) => {
        emitToUser(io, onlineUsers, callerId, 'callAnswered', {
            answer,
            responderId: socket.userId,
        });
    });

    socket.on('rejectCall', ({ callerId }) => {
        emitToUser(io, onlineUsers, callerId, 'callRejected', {
            responderId: socket.userId,
        });
    });

    socket.on('iceCandidate', ({ recipientId, candidate }) => {
        emitToUser(io, onlineUsers, recipientId, 'iceCandidate', {
            candidate,
            senderId: socket.userId,
        });
    });

    socket.on('endCall', ({ recipientId }) => {
        emitToUser(io, onlineUsers, recipientId, 'callEnded', {
            endedBy: socket.userId,
        });
    });

    socket.on('startGroupCall', async ({ chatId, callType = 'video' }) => {
        try {
            const normalizedChatId = chatId?.toString?.() || chatId;
            const chat = await getGroupChat(normalizedChatId, socket.userId);

            if (!chat) {
                socket.emit('callError', { error: 'Group chat not found' });
                return;
            }

            const existingCall = activeGroupCalls.get(normalizedChatId);
            if (existingCall) {
                const wasParticipant = isCallParticipant(existingCall, socket.userId);
                const participantInfo = serializeUser(socket.user);
                existingCall.participants.set(socket.userId, serializeUser(socket.user));
                socket.join(getCallRoom(normalizedChatId));
                trackSocketCall(socket, normalizedChatId);
                socket.emit('groupCallJoined', {
                    chatId: normalizedChatId,
                    chatName: chat.groupName,
                    chatAvatar: chat.groupAvatar || '',
                    callType: existingCall.callType,
                    hostId: existingCall.hostId,
                    participants: [...existingCall.participants.values()],
                });

                if (!wasParticipant) {
                    socket.to(getCallRoom(normalizedChatId)).emit('groupParticipantJoined', {
                        chatId: normalizedChatId,
                        participant: participantInfo,
                        callType: existingCall.callType,
                    });
                }
                return;
            }

            const hostInfo = serializeUser(socket.user);
            activeGroupCalls.set(normalizedChatId, {
                hostId: socket.userId,
                callType,
                participants: new Map([[socket.userId, hostInfo]]),
            });

            socket.join(getCallRoom(normalizedChatId));
            trackSocketCall(socket, normalizedChatId);

            socket.emit('groupCallJoined', {
                chatId: normalizedChatId,
                chatName: chat.groupName,
                chatAvatar: chat.groupAvatar || '',
                callType,
                hostId: socket.userId,
                participants: [hostInfo],
            });

            chat.participants
                .filter((participant) => participant._id.toString() !== socket.userId)
                .forEach((participant) => {
                    emitToUser(io, onlineUsers, participant._id.toString(), 'incomingCall', {
                        callerId: socket.userId,
                        callerInfo: hostInfo,
                        callType,
                        isGroupCall: true,
                        chatId: normalizedChatId,
                        chatName: chat.groupName,
                        chatAvatar: chat.groupAvatar || '',
                    });
                });
        } catch (error) {
            console.error('Start group call error:', error);
            socket.emit('callError', { error: 'Failed to start group call' });
        }
    });

    socket.on('joinGroupCall', async ({ chatId }) => {
        try {
            const normalizedChatId = chatId?.toString?.() || chatId;
            const call = activeGroupCalls.get(normalizedChatId);
            if (!call) {
                socket.emit('callError', { error: 'This group call has already ended' });
                return;
            }

            const chat = await getGroupChat(normalizedChatId, socket.userId);
            if (!chat) {
                socket.emit('callError', { error: 'Group chat not found' });
                return;
            }

            const participantInfo = serializeUser(socket.user);
            call.participants.set(socket.userId, participantInfo);
            socket.join(getCallRoom(normalizedChatId));
            trackSocketCall(socket, normalizedChatId);

            socket.emit('groupCallJoined', {
                chatId: normalizedChatId,
                chatName: chat.groupName,
                chatAvatar: chat.groupAvatar || '',
                callType: call.callType,
                hostId: call.hostId,
                participants: [...call.participants.values()],
            });

            socket.to(getCallRoom(normalizedChatId)).emit('groupParticipantJoined', {
                chatId: normalizedChatId,
                participant: participantInfo,
                callType: call.callType,
            });
        } catch (error) {
            console.error('Join group call error:', error);
            socket.emit('callError', { error: 'Failed to join group call' });
        }
    });

    socket.on('groupCallOffer', ({ chatId, targetUserId, offer }) => {
        const call = getActiveGroupCall(chatId);
        if (!call || !isCallParticipant(call, socket.userId) || !isCallParticipant(call, targetUserId)) {
            socket.emit('callError', { error: 'Invalid group call signaling request' });
            return;
        }

        emitToUser(io, onlineUsers, targetUserId, 'groupCallOffer', {
            chatId,
            offer,
            senderId: socket.userId,
            senderInfo: serializeUser(socket.user),
        });
    });

    socket.on('groupCallAnswer', ({ chatId, targetUserId, answer }) => {
        const call = getActiveGroupCall(chatId);
        if (!call || !isCallParticipant(call, socket.userId) || !isCallParticipant(call, targetUserId)) {
            socket.emit('callError', { error: 'Invalid group call signaling request' });
            return;
        }

        emitToUser(io, onlineUsers, targetUserId, 'groupCallAnswer', {
            chatId,
            answer,
            senderId: socket.userId,
            senderInfo: serializeUser(socket.user),
        });
    });

    socket.on('groupCallIceCandidate', ({ chatId, targetUserId, candidate }) => {
        const call = getActiveGroupCall(chatId);
        if (!call || !isCallParticipant(call, socket.userId) || !isCallParticipant(call, targetUserId)) {
            socket.emit('callError', { error: 'Invalid group call signaling request' });
            return;
        }

        emitToUser(io, onlineUsers, targetUserId, 'groupCallIceCandidate', {
            chatId,
            candidate,
            senderId: socket.userId,
        });
    });

    socket.on('leaveGroupCall', ({ chatId }) => {
        const call = getActiveGroupCall(chatId);
        if (call && !isCallParticipant(call, socket.userId)) {
            return;
        }
        leaveGroupCall({ io, socket, chatId });
    });

    socket.on('toggleMedia', ({ recipientId, chatId, type, enabled }) => {
        if (chatId) {
            const call = getActiveGroupCall(chatId);
            if (!call || !isCallParticipant(call, socket.userId)) {
                socket.emit('callError', { error: 'Invalid group call state' });
                return;
            }

            socket.to(getCallRoom(chatId)).emit('mediaToggled', {
                chatId,
                userId: socket.userId,
                type,
                enabled,
            });
            return;
        }

        emitToUser(io, onlineUsers, recipientId, 'mediaToggled', {
            userId: socket.userId,
            type,
            enabled,
        });
    });

    socket.on('disconnect', () => {
        if (!socket.data.groupCalls?.size) return;

        [...socket.data.groupCalls].forEach((chatId) => {
            leaveGroupCall({ io, socket, chatId });
        });
    });
};
