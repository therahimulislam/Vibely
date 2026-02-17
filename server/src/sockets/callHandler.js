// server/src/sockets/callHandler.js
// WebRTC signaling for video calls

module.exports = (io, socket, onlineUsers) => {
    // Initiate a call
    socket.on('callUser', ({ recipientId, offer, callerInfo }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('incomingCall', {
                callerId: socket.userId,
                callerInfo,
                offer,
            });
        } else {
            socket.emit('callError', { error: 'User is offline' });
        }
    });

    // Answer a call
    socket.on('answerCall', ({ callerId, answer }) => {
        const callerSocketId = onlineUsers.get(callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('callAnswered', {
                answer,
                responderId: socket.userId,
            });
        }
    });

    // Reject a call
    socket.on('rejectCall', ({ callerId }) => {
        const callerSocketId = onlineUsers.get(callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('callRejected', {
                responderId: socket.userId,
            });
        }
    });

    // ICE candidate exchange
    socket.on('iceCandidate', ({ recipientId, candidate }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('iceCandidate', {
                candidate,
                senderId: socket.userId,
            });
        }
    });

    // End call
    socket.on('endCall', ({ recipientId }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('callEnded', {
                endedBy: socket.userId,
            });
        }
    });

    // Toggle media (mute/camera off notification)
    socket.on('toggleMedia', ({ recipientId, type, enabled }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('mediaToggled', {
                userId: socket.userId,
                type, // 'audio' or 'video'
                enabled,
            });
        }
    });
};
