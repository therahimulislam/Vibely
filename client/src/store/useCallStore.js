// client/src/store/useCallStore.js
// Video call state management

import { create } from 'zustand';

const useCallStore = create((set) => ({
    isInCall: false,
    isCalling: false,
    isReceivingCall: false,
    callerId: null,
    callerInfo: null,
    recipientId: null,
    localStream: null,
    remoteStream: null,
    offer: null,
    isAudioMuted: false,
    isVideoOff: false,

    // Start outgoing call
    startCall: (recipientId) => {
        set({ isCalling: true, recipientId, isInCall: false });
    },

    // Receive incoming call
    receiveCall: ({ callerId, callerInfo, offer }) => {
        set({ isReceivingCall: true, callerId, callerInfo, offer });
    },

    // Call connected
    callConnected: () => {
        set({ isInCall: true, isCalling: false, isReceivingCall: false });
    },

    // Set streams
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),

    // Toggle media
    toggleAudio: () => set((state) => ({ isAudioMuted: !state.isAudioMuted })),
    toggleVideo: () => set((state) => ({ isVideoOff: !state.isVideoOff })),

    // End call
    endCall: () => {
        set((state) => {
            // Stop all tracks
            state.localStream?.getTracks().forEach((t) => t.stop());
            state.remoteStream?.getTracks().forEach((t) => t.stop());
            return {
                isInCall: false,
                isCalling: false,
                isReceivingCall: false,
                callerId: null,
                callerInfo: null,
                recipientId: null,
                localStream: null,
                remoteStream: null,
                offer: null,
                isAudioMuted: false,
                isVideoOff: false,
            };
        });
    },
}));

export default useCallStore;
