// Socket.io connection hook with event handling

import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import useCallStore from '../store/useCallStore';
import useStatusStore from '../store/useStatusStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;
let socketToken = null;
let listenersBound = false;

export const getSocket = () => socketInstance;

const bindSocketListeners = () => {
    if (!socketInstance || listenersBound) return;

    socketInstance.on('connect', () => {
        console.log('Socket connected');
    });

    socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
    });

    socketInstance.on('receiveMessage', ({ message, chatId }) => {
        useChatStore.getState().addMessage(message);

        if (useChatStore.getState().activeChat?._id === chatId) {
            socketInstance?.emit('messageSeen', {
                chatId,
                senderId: message.senderId._id || message.senderId,
            });
        }
    });

    socketInstance.on('messageSent', ({ message }) => {
        useChatStore.getState().addMessage(message);
    });

    socketInstance.on('messageUpdated', ({ message }) => {
        useChatStore.getState().updateMessage(message);
    });

    socketInstance.on('messageDeleted', ({ messageId, type = 'me' }) => {
        useChatStore.getState().removeMessage(messageId, type);
    });

    socketInstance.on('messagesSeen', ({ chatId }) => {
        useChatStore.getState().setMessagesSeen(chatId);
    });

    socketInstance.on('userTyping', ({ chatId, userId }) => {
        useChatStore.getState().setTyping(chatId, userId);
    });

    socketInstance.on('userStopTyping', ({ chatId }) => {
        useChatStore.getState().clearTyping(chatId);
    });

    socketInstance.on('onlineUsers', ({ userIds = [] }) => {
        useChatStore.getState().setOnlineUsers(userIds);
    });

    socketInstance.on('userOnline', ({ userId }) => {
        useChatStore.getState().setUserOnline(userId);
    });

    socketInstance.on('userOffline', ({ userId }) => {
        useChatStore.getState().setUserOffline(userId);
    });

    socketInstance.on('incomingCall', (payload) => {
        useCallStore.getState().receiveCall(payload);
    });

    socketInstance.on('callRejected', () => {
        useCallStore.getState().endCall();
    });

    socketInstance.on('mediaToggled', ({ userId, type, enabled }) => {
        useCallStore.getState().setParticipantMediaState(userId, type, enabled);
    });

    socketInstance.on('callError', ({ error }) => {
        if (error) {
            toast.error(error);
        }
    });

    socketInstance.on('status:updated', () => {
        useStatusStore.getState().fetchStatuses();
    });

    socketInstance.on('status:viewed', (payload) => {
        useStatusStore.getState().applySeenUpdate(payload);
    });

    listenersBound = true;
};

const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
    socketToken = null;
    listenersBound = false;
    useChatStore.getState().setOnlineUsers([]);
};

const useSocket = () => {
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated) {
            disconnectSocket();
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        if (!socketInstance || socketToken !== token) {
            disconnectSocket();
            socketInstance = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });
            socketToken = token;
        }

        bindSocketListeners();
    }, [isAuthenticated]);

    const sendMessage = useCallback((data) => {
        socketInstance?.emit('sendMessage', data);
    }, []);

    const emitTyping = useCallback((chatId, recipientId) => {
        socketInstance?.emit('typing', { chatId, recipientId });
    }, []);

    const emitStopTyping = useCallback((chatId, recipientId) => {
        socketInstance?.emit('stopTyping', { chatId, recipientId });
    }, []);

    const emitMessageSeen = useCallback((chatId, senderId) => {
        socketInstance?.emit('messageSeen', { chatId, senderId });
    }, []);

    const emitReaction = useCallback((messageId, emoji, recipientId) => {
        socketInstance?.emit('messageReaction', { messageId, emoji, recipientId });
    }, []);

    const emitDeleteMessage = useCallback((messageId, chatId, recipientId, type = 'me') => {
        if (!socketInstance) return;
        socketInstance.emit('deleteMessage', { messageId, chatId, recipientId, type });
        useChatStore.getState().removeMessage(messageId, type);
    }, []);

    const emitEditMessage = useCallback((messageId, text, recipientId) => {
        socketInstance?.emit('editMessage', { messageId, text, recipientId });
    }, []);

    return {
        socket: socketInstance,
        sendMessage,
        emitTyping,
        emitStopTyping,
        emitMessageSeen,
        emitReaction,
        emitDeleteMessage,
        emitEditMessage,
    };
};

export default useSocket;
