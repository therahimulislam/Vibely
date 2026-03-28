// Socket.io connection hook with event handling

import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import useCallStore from '../store/useCallStore';
import useStatusStore from '../store/useStatusStore';
import useReminderStore from '../store/useReminderStore';
import { API_URL } from '../api/axios';
import { normalizeSocketUrl } from '../utils/env';

const SOCKET_URL = normalizeSocketUrl(import.meta.env.VITE_SOCKET_URL, API_URL);

let socketInstance = null;
let socketToken = null;
let listenersBound = false;
let audioContext = null;

const sameId = (left, right) => String(left || '') === String(right || '');

const getNotificationSettings = (chatId) => {
    const preferences = useAuthStore.getState().user?.preferences || {};
    const saved = (preferences.chatNotifications || []).find((entry) => sameId(entry.chatId, chatId));

    return {
        mutedUntil: null,
        mentionsOnly: false,
        sound: 'default',
        desktop: false,
        ...(saved || {}),
    };
};

const isMuted = (settings) => {
    if (!settings?.mutedUntil) return false;
    const mutedUntil = new Date(settings.mutedUntil);
    return !Number.isNaN(mutedUntil.getTime()) && mutedUntil.getTime() > Date.now();
};

const getIncomingMessagePreview = (message) => {
    if (!message) return 'New message';
    if (message.viewOnce?.enabled) {
        return message.type === 'video' ? 'View once video' : 'View once photo';
    }
    if (message.type === 'poll') return `Poll: ${message.poll?.question || 'New poll'}`;
    if (message.type === 'audio') return 'Voice message';
    if (message.type === 'video') return message.text || 'Video';
    if (message.type === 'image') return message.text || 'Photo';
    if (message.type === 'document') return message.fileName || 'Document';
    return message.text || 'New message';
};

const shouldNotifyForMessage = (message, currentUser, settings) => {
    if (!currentUser || !message) return false;

    const senderId = message.senderId?._id || message.senderId;
    if (sameId(senderId, currentUser._id)) return false;
    if (isMuted(settings)) return false;

    if (settings.mentionsOnly && message.chatId?.isGroup !== false) {
        const normalizedText = `${message.text || ''}`.toLowerCase();
        const normalizedUsername = `${currentUser.username || ''}`.toLowerCase();
        if (!normalizedUsername || !normalizedText.includes(`@${normalizedUsername}`)) {
            return false;
        }
    }

    const activeChatId = useChatStore.getState().activeChat?._id;
    const isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    const isCurrentChat = sameId(activeChatId, message.chatId || message.chatId?._id || '');

    return !(isVisible && isCurrentChat);
};

const playNotificationTone = () => {
    if (typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        audioContext = audioContext || new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.03;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const now = audioContext.currentTime;
        oscillator.start(now);
        oscillator.stop(now + 0.12);
    } catch (error) {
        console.error('Notification tone failed:', error);
    }
};

const notifyIncomingMessage = ({ message, chatId }) => {
    const currentUser = useAuthStore.getState().user;
    const settings = getNotificationSettings(chatId);
    if (!shouldNotifyForMessage({ ...message, chatId }, currentUser, settings)) {
        return;
    }

    const senderName = message.senderId?.name || 'New message';
    const preview = getIncomingMessagePreview(message);

    toast.success(`${senderName}: ${preview}`);

    if (settings.sound !== 'silent') {
        playNotificationTone();
    }

    if (settings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(senderName, {
            body: preview,
            icon: message.senderId?.avatar || '/icons/icon-192.png',
        });
    }
};

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
        notifyIncomingMessage({ message, chatId });

        if (useChatStore.getState().activeChat?._id === chatId) {
            socketInstance?.emit('messageSeen', {
                chatId,
                senderId: message.senderId._id || message.senderId,
            });
        }
    });

    socketInstance.on('messageSent', ({ message, scheduledMessageId }) => {
        useChatStore.getState().addMessage(message);
        if (scheduledMessageId) {
            useChatStore.getState().removeScheduledMessageFromQueue(scheduledMessageId);
        }
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

    socketInstance.on('userOffline', ({ userId, lastSeen }) => {
        useChatStore.getState().setUserOffline(userId, lastSeen);
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

    socketInstance.on('reminderDue', ({ reminder }) => {
        useReminderStore.getState().upsertReminder(reminder);
        const senderName = reminder?.messageId?.senderId?.name || 'message';
        toast.success(`Reminder: revisit ${senderName}`);
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
