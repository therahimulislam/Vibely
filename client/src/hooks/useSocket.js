// client/src/hooks/useSocket.js
// Socket.io connection hook with event handling

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import useCallStore from '../store/useCallStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

export const getSocket = () => socketInstance;

const useSocket = () => {
    const { isAuthenticated } = useAuthStore();
    const { addMessage, updateMessage, removeMessage, setTyping, clearTyping, setUserOnline, setUserOffline, setMessagesSeen, activeChat } = useChatStore();
    const { receiveCall } = useCallStore();
    const activeChatRef = useRef(activeChat);

    // Keep ref in sync
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    useEffect(() => {
        if (!isAuthenticated) {
            if (socketInstance) {
                socketInstance.disconnect();
                socketInstance = null;
            }
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        // Connect socket
        socketInstance = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        const socket = socketInstance;

        socket.on('connect', () => {
            console.log('🔌 Socket connected');
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        // ─── Message Events ─────────────────────────────
        socket.on('receiveMessage', ({ message, chatId }) => {
            addMessage(message);

            // Auto mark as seen if viewing this chat
            if (activeChatRef.current?._id === chatId) {
                socket.emit('messageSeen', {
                    chatId,
                    senderId: message.senderId._id || message.senderId,
                });
            }
        });

        socket.on('messageSent', ({ message, tempId }) => {
            addMessage(message);
        });

        socket.on('messageUpdated', ({ message }) => {
            updateMessage(message);
        });

        socket.on('messageDeleted', ({ messageId }) => {
            removeMessage(messageId);
        });

        socket.on('messagesSeen', ({ chatId }) => {
            setMessagesSeen(chatId);
        });

        // ─── Typing Events ─────────────────────────────
        socket.on('userTyping', ({ chatId, userId }) => {
            setTyping(chatId, userId);
        });

        socket.on('userStopTyping', ({ chatId }) => {
            clearTyping(chatId);
        });

        // ─── Online Status ──────────────────────────────
        socket.on('userOnline', ({ userId }) => {
            setUserOnline(userId);
        });

        socket.on('userOffline', ({ userId }) => {
            setUserOffline(userId);
        });

        // ─── Call Events ────────────────────────────────
        socket.on('incomingCall', ({ callerId, callerInfo, offer }) => {
            receiveCall({ callerId, callerInfo, offer });
        });

        socket.on('callAnswered', ({ answer }) => {
            // Handled in useWebRTC hook
            socket.emit('callAnswerReceived', { answer });
        });

        socket.on('callRejected', () => {
            useCallStore.getState().endCall();
        });

        socket.on('callEnded', () => {
            useCallStore.getState().endCall();
        });

        return () => {
            socket.disconnect();
            socketInstance = null;
        };
    }, [isAuthenticated]);

    // Emit helpers
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

        // Optimistic update handled by store for 'me', 
        // for 'everyone' we wait for server ack usually, but store handles both
        useChatStore.getState().removeMessage(messageId, type);
    }, [socketInstance]);

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
