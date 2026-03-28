// client/src/store/useCallStore.js
// Shared call state for direct and group audio/video calls

import { create } from 'zustand';

const stopStream = (stream) => {
    stream?.getTracks?.().forEach((track) => track.stop());
};

const stopParticipantStreams = (participants = {}) => {
    Object.values(participants).forEach((participant) => {
        stopStream(participant?.stream);
    });
};

const getInitialState = () => ({
    isInCall: false,
    isCalling: false,
    isReceivingCall: false,
    isMinimized: false,
    showParticipants: false,
    callMode: 'direct',
    callType: 'video',
    chatId: null,
    chatName: '',
    chatAvatar: '',
    callerId: null,
    callerInfo: null,
    recipientId: null,
    offer: null,
    localStream: null,
    remoteParticipants: {},
    isAudioMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    callStartedAt: null,
});

const useCallStore = create((set, get) => ({
    ...getInitialState(),

    startDirectCall: ({ recipientId, recipientInfo = null, callType = 'video' }) => {
        set({
            ...getInitialState(),
            isCalling: true,
            callMode: 'direct',
            recipientId,
            callerInfo: recipientInfo,
            callType,
        });
    },

    startGroupCall: ({ chatId, chatName, chatAvatar, callType = 'video' }) => {
        set({
            ...getInitialState(),
            isCalling: true,
            callMode: 'group',
            chatId,
            chatName: chatName || 'Group Call',
            chatAvatar: chatAvatar || '',
            callerInfo: { name: chatName || 'Group Call', avatar: chatAvatar || '' },
            callType,
        });
    },

    receiveCall: (payload) => {
        set((state) => {
            if (state.isInCall || state.isCalling || state.isReceivingCall) {
                return state;
            }

            return {
                ...state,
                isReceivingCall: true,
                callMode: payload?.isGroupCall ? 'group' : 'direct',
                callType: payload?.callType || 'video',
                callerId: payload?.callerId || null,
                callerInfo: payload?.callerInfo || null,
                recipientId: payload?.callerId || null,
                offer: payload?.offer || null,
                chatId: payload?.chatId || null,
                chatName: payload?.chatName || '',
                chatAvatar: payload?.chatAvatar || '',
            };
        });
    },

    clearIncomingCall: () => {
        set({
            isReceivingCall: false,
            isMinimized: false,
            showParticipants: false,
            callerId: null,
            callerInfo: null,
            recipientId: null,
            offer: null,
            chatId: null,
            chatName: '',
            chatAvatar: '',
            callMode: 'direct',
            callType: 'video',
        });
    },

    callConnected: () => {
        set((state) => ({
            isInCall: true,
            isCalling: false,
            isReceivingCall: false,
            callStartedAt: state.callStartedAt || Date.now(),
        }));
    },

    setLocalStream: (stream) => set({ localStream: stream }),
    setMinimized: (isMinimized) => set({ isMinimized }),
    setShowParticipants: (showParticipants) => set({ showParticipants }),

    syncRemoteParticipants: (participants = []) => {
        set((state) => {
            const nextParticipants = {};

            participants.forEach((participant) => {
                const userId = participant?._id || participant?.userId;
                if (!userId) return;

                const existing = state.remoteParticipants[userId];
                nextParticipants[userId] = {
                    userId,
                    name: participant?.name || existing?.name || 'Unknown',
                    avatar: participant?.avatar || existing?.avatar || '',
                    username: participant?.username || existing?.username || '',
                    stream: existing?.stream || null,
                    isConnected: existing?.isConnected || false,
                    isMuted: existing?.isMuted || false,
                    isVideoOff: existing?.isVideoOff || false,
                };
            });

            Object.entries(state.remoteParticipants).forEach(([userId, participant]) => {
                if (!nextParticipants[userId] && participant?.stream) {
                    stopStream(participant.stream);
                }
            });

            return { remoteParticipants: nextParticipants };
        });
    },

    upsertRemoteParticipant: (participant = {}) => {
        const userId = participant?._id || participant?.userId;
        if (!userId) return;

        set((state) => ({
            remoteParticipants: {
                ...state.remoteParticipants,
                [userId]: {
                    userId,
                    name: participant?.name || state.remoteParticipants[userId]?.name || 'Unknown',
                    avatar: participant?.avatar || state.remoteParticipants[userId]?.avatar || '',
                    username: participant?.username || state.remoteParticipants[userId]?.username || '',
                    stream: participant?.stream ?? state.remoteParticipants[userId]?.stream ?? null,
                    isConnected: participant?.isConnected ?? state.remoteParticipants[userId]?.isConnected ?? false,
                    isMuted: participant?.isMuted ?? state.remoteParticipants[userId]?.isMuted ?? false,
                    isVideoOff: participant?.isVideoOff ?? state.remoteParticipants[userId]?.isVideoOff ?? false,
                },
            },
        }));
    },

    setParticipantStream: (userId, stream) => {
        if (!userId) return;

        set((state) => {
            const existing = state.remoteParticipants[userId] || { userId };
            return {
                remoteParticipants: {
                    ...state.remoteParticipants,
                    [userId]: {
                        ...existing,
                        stream,
                        isConnected: true,
                    },
                },
            };
        });
    },

    setParticipantMediaState: (userId, type, enabled) => {
        if (!userId) return;

        set((state) => {
            const existing = state.remoteParticipants[userId];
            if (!existing) return state;

            return {
                remoteParticipants: {
                    ...state.remoteParticipants,
                    [userId]: {
                        ...existing,
                        isMuted: type === 'audio' ? !enabled : existing.isMuted,
                        isVideoOff: type === 'video' ? !enabled : existing.isVideoOff,
                    },
                },
            };
        });
    },

    removeRemoteParticipant: (userId) => {
        if (!userId) return;

        set((state) => {
            const nextParticipants = { ...state.remoteParticipants };
            stopStream(nextParticipants[userId]?.stream);
            delete nextParticipants[userId];
            return { remoteParticipants: nextParticipants };
        });
    },

    toggleAudio: () => set((state) => ({ isAudioMuted: !state.isAudioMuted })),
    toggleVideo: () => set((state) => ({ isVideoOff: !state.isVideoOff })),
    setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),

    endCall: () => {
        const state = get();
        stopStream(state.localStream);
        stopParticipantStreams(state.remoteParticipants);
        set(getInitialState());
    },
}));

export default useCallStore;
