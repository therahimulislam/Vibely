// client/src/hooks/useWebRTC.js
// WebRTC hook for direct and group audio/video calls

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import useCallStore from '../store/useCallStore';
import useAuthStore from '../store/useAuthStore';
import { STUN_SERVERS } from '../utils/constants';

let peerConnections = new Map();
let boundSocket = null;
let facingModeState = 'user';
let screenStream = null;

const stopTracks = (stream) => {
    stream?.getTracks?.().forEach((track) => track.stop());
};

const closeConnection = (userId, preserveParticipant = false) => {
    const connection = peerConnections.get(userId);
    if (!connection) return;

    connection.ontrack = null;
    connection.onicecandidate = null;
    connection.onconnectionstatechange = null;
    connection.close();
    peerConnections.delete(userId);

    if (!preserveParticipant) {
        useCallStore.getState().removeRemoteParticipant(userId);
    }
};

const cleanupAllConnections = () => {
    [...peerConnections.keys()].forEach((userId) => closeConnection(userId, true));
    peerConnections = new Map();
};

const stopScreenShareStream = () => {
    stopTracks(screenStream);
    screenStream = null;
};

const resetCall = () => {
    cleanupAllConnections();
    stopScreenShareStream();
    useCallStore.getState().endCall();
    facingModeState = 'user';
};

const buildParticipant = (userId, info = {}) => ({
    userId,
    _id: userId,
    name: info?.name || 'Unknown',
    avatar: info?.avatar || '',
    username: info?.username || '',
});

const useWebRTC = () => {
    const callState = useCallStore();
    const { user } = useAuthStore();
    const [facingMode, setFacingMode] = useState(facingModeState);

    const getMedia = useCallback(async (mode = 'user', requestedType = 'video') => navigator.mediaDevices.getUserMedia({
        video: requestedType === 'video' ? { facingMode: mode } : false,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    }), []);

    const ensureLocalStream = useCallback(async (requestedType = 'video') => {
        const existing = useCallStore.getState().localStream;
        const hasVideoTrack = existing?.getVideoTracks?.().length > 0;

        if (existing && (requestedType === 'audio' || hasVideoTrack)) {
            return existing;
        }

        stopTracks(existing);
        const nextStream = await getMedia(facingModeState, requestedType);
        useCallStore.getState().setLocalStream(nextStream);
        return nextStream;
    }, [getMedia]);

    const createPeerConnection = useCallback((userId, { isGroup = false, chatId = null } = {}) => {
        closeConnection(userId, true);

        const stream = useCallStore.getState().localStream;
        if (!stream) {
            throw new Error('Local stream is not ready');
        }

        const pc = new RTCPeerConnection(STUN_SERVERS);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            if (remoteStream) {
                useCallStore.getState().setParticipantStream(userId, remoteStream);
            }
        };

        pc.onicecandidate = (event) => {
            if (!event.candidate) return;

            if (isGroup && chatId) {
                getSocket()?.emit('groupCallIceCandidate', {
                    chatId,
                    targetUserId: userId,
                    candidate: event.candidate,
                });
                return;
            }

            getSocket()?.emit('iceCandidate', {
                recipientId: userId,
                candidate: event.candidate,
            });
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                useCallStore.getState().upsertRemoteParticipant({
                    userId,
                    isConnected: true,
                });
                useCallStore.getState().callConnected();
            }

            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                const mode = useCallStore.getState().callMode;
                closeConnection(userId);

                if (mode === 'direct') {
                    resetCall();
                }
            }
        };

        peerConnections.set(userId, pc);
        return pc;
    }, []);

    const createGroupOffer = useCallback(async (participant, chatId) => {
        const userId = participant?._id || participant?.userId;
        if (!userId || userId === user?._id || peerConnections.has(userId)) return;

        useCallStore.getState().upsertRemoteParticipant(participant);
        const pc = createPeerConnection(userId, { isGroup: true, chatId });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        getSocket()?.emit('groupCallOffer', {
            chatId,
            targetUserId: userId,
            offer,
        });
    }, [createPeerConnection, user?._id]);

    const bindSocketListeners = useCallback(() => {
        const socket = getSocket();
        if (!socket || boundSocket === socket) return;

        const handleCallAnswered = async ({ answer, responderId }) => {
            const userId = responderId || useCallStore.getState().recipientId;
            const pc = peerConnections.get(userId);
            if (!pc) return;

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                useCallStore.getState().upsertRemoteParticipant({
                    userId,
                    ...(useCallStore.getState().remoteParticipants[userId] || useCallStore.getState().callerInfo || {}),
                });
            } catch (error) {
                console.error('Failed to apply call answer:', error);
                resetCall();
            }
        };

        const handleIceCandidate = async ({ candidate, senderId }) => {
            const userId = senderId || useCallStore.getState().recipientId || useCallStore.getState().callerId;
            const pc = peerConnections.get(userId);
            if (!pc || !candidate) return;

            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('ICE candidate error:', error);
            }
        };

        const handleGroupCallJoined = ({ chatId, chatName, chatAvatar, callType, participants = [] }) => {
            const remoteParticipants = participants.filter((participant) => participant._id !== user?._id);

            useCallStore.setState({
                chatId,
                chatName,
                chatAvatar,
                callType,
                callMode: 'group',
                callerInfo: { name: chatName || 'Group Call', avatar: chatAvatar || '' },
                isCalling: false,
                isReceivingCall: false,
                isInCall: true,
            });
            useCallStore.getState().syncRemoteParticipants(remoteParticipants);
        };

        const handleGroupParticipantJoined = async ({ chatId, participant }) => {
            if (!participant || participant._id === user?._id) return;

            useCallStore.getState().upsertRemoteParticipant(participant);

            try {
                await createGroupOffer(participant, chatId);
            } catch (error) {
                console.error('Failed to create group call offer:', error);
            }
        };

        const handleGroupCallOffer = async ({ chatId, senderId, senderInfo, offer }) => {
            if (!offer || senderId === user?._id) return;

            try {
                useCallStore.getState().upsertRemoteParticipant(buildParticipant(senderId, senderInfo));
                const pc = createPeerConnection(senderId, { isGroup: true, chatId });
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                getSocket()?.emit('groupCallAnswer', {
                    chatId,
                    targetUserId: senderId,
                    answer,
                });
            } catch (error) {
                console.error('Failed to answer group call offer:', error);
            }
        };

        const handleGroupCallAnswer = async ({ senderId, senderInfo, answer }) => {
            const pc = peerConnections.get(senderId);
            if (!pc || !answer) return;

            try {
                useCallStore.getState().upsertRemoteParticipant(buildParticipant(senderId, senderInfo));
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Failed to apply group call answer:', error);
            }
        };

        const handleGroupCallIceCandidate = async ({ senderId, candidate }) => {
            const pc = peerConnections.get(senderId);
            if (!pc || !candidate) return;

            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Group ICE candidate error:', error);
            }
        };

        const handleGroupParticipantLeft = ({ userId }) => {
            closeConnection(userId);
        };

        const handleGroupCallEnded = () => {
            toast('Group call ended');
            resetCall();
        };

        const handleCallRejected = () => {
            resetCall();
        };

        const handleCallEnded = () => {
            resetCall();
        };

        socket.on('callAnswered', handleCallAnswered);
        socket.on('callRejected', handleCallRejected);
        socket.on('iceCandidate', handleIceCandidate);
        socket.on('callEnded', handleCallEnded);
        socket.on('groupCallJoined', handleGroupCallJoined);
        socket.on('groupParticipantJoined', handleGroupParticipantJoined);
        socket.on('groupCallOffer', handleGroupCallOffer);
        socket.on('groupCallAnswer', handleGroupCallAnswer);
        socket.on('groupCallIceCandidate', handleGroupCallIceCandidate);
        socket.on('groupParticipantLeft', handleGroupParticipantLeft);
        socket.on('groupCallEnded', handleGroupCallEnded);

        boundSocket = socket;
    }, [createGroupOffer, createPeerConnection, user?._id]);

    useEffect(() => {
        bindSocketListeners();
    }, [bindSocketListeners]);

    useEffect(() => {
        setFacingMode(facingModeState);
    }, []);

    const startCall = useCallback(async (target, requestedType = 'video', targetInfo = null) => {
        try {
            stopScreenShareStream();
            if (typeof target === 'object' && target?.chatId) {
                useCallStore.getState().startGroupCall({
                    chatId: target.chatId,
                    chatName: target.chatName,
                    chatAvatar: target.chatAvatar,
                    callType: requestedType,
                });

                await ensureLocalStream(requestedType);
                useCallStore.getState().callConnected();
                getSocket()?.emit('startGroupCall', {
                    chatId: target.chatId,
                    callType: requestedType,
                });
                return;
            }

            useCallStore.getState().startDirectCall({
                recipientId: target,
                recipientInfo: targetInfo,
                callType: requestedType,
            });

            const stream = await ensureLocalStream(requestedType);
            const pc = createPeerConnection(target);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            getSocket()?.emit('callUser', {
                recipientId: target,
                offer,
                callerInfo: { name: user?.name, avatar: user?.avatar, username: user?.username },
                callType: requestedType,
            });

            useCallStore.getState().upsertRemoteParticipant(buildParticipant(target, targetInfo || {}));
            useCallStore.getState().setLocalStream(stream);
        } catch (error) {
            console.error('Failed to start call:', error);
            resetCall();
        }
    }, [createPeerConnection, ensureLocalStream, user?.avatar, user?.name, user?.username]);

    const answerCall = useCallback(async () => {
        const state = useCallStore.getState();

        try {
            if (state.callMode === 'group') {
                await ensureLocalStream(state.callType);
                useCallStore.setState({ isCalling: true, isReceivingCall: false, isInCall: true });
                getSocket()?.emit('joinGroupCall', { chatId: state.chatId });
                return;
            }

            const stream = await ensureLocalStream(state.callType);
            const pc = createPeerConnection(state.callerId);
            await pc.setRemoteDescription(new RTCSessionDescription(state.offer || callState.offer));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            getSocket()?.emit('answerCall', {
                callerId: state.callerId,
                answer,
            });

            useCallStore.getState().upsertRemoteParticipant(buildParticipant(state.callerId, state.callerInfo));
            useCallStore.getState().setLocalStream(stream);
            useCallStore.getState().callConnected();
        } catch (error) {
            console.error('Failed to answer call:', error);
            resetCall();
        }
    }, [callState.offer, createPeerConnection, ensureLocalStream]);

    const rejectCall = useCallback(() => {
        const state = useCallStore.getState();

        if (state.callMode === 'group') {
            useCallStore.getState().clearIncomingCall();
            return;
        }

        if (state.callerId) {
            getSocket()?.emit('rejectCall', { callerId: state.callerId });
        }

        resetCall();
    }, []);

    const endCall = useCallback(() => {
        const state = useCallStore.getState();

        if (state.callMode === 'group' && state.chatId) {
            getSocket()?.emit('leaveGroupCall', { chatId: state.chatId });
            resetCall();
            return;
        }

        const targetId = state.recipientId || state.callerId;
        if (targetId) {
            getSocket()?.emit('endCall', { recipientId: targetId });
        }
        resetCall();
    }, []);

    const toggleAudio = useCallback(() => {
        const state = useCallStore.getState();
        const stream = state.localStream;
        if (!stream) return;

        stream.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        state.toggleAudio();

        const enabled = stream.getAudioTracks()[0]?.enabled ?? true;
        if (state.callMode === 'group' && state.chatId) {
            getSocket()?.emit('toggleMedia', {
                chatId: state.chatId,
                type: 'audio',
                enabled,
            });
            return;
        }

        const targetId = state.recipientId || state.callerId;
        if (targetId) {
            getSocket()?.emit('toggleMedia', {
                recipientId: targetId,
                type: 'audio',
                enabled,
            });
        }
    }, []);

    const toggleVideo = useCallback(() => {
        const state = useCallStore.getState();
        const stream = state.localStream;
        if (!stream || state.callType !== 'video') return;

        stream.getVideoTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        state.toggleVideo();

        const enabled = stream.getVideoTracks()[0]?.enabled ?? true;
        if (state.callMode === 'group' && state.chatId) {
            getSocket()?.emit('toggleMedia', {
                chatId: state.chatId,
                type: 'video',
                enabled,
            });
            return;
        }

        const targetId = state.recipientId || state.callerId;
        if (targetId) {
            getSocket()?.emit('toggleMedia', {
                recipientId: targetId,
                type: 'video',
                enabled,
            });
        }
    }, []);

    const switchCamera = useCallback(async () => {
        const state = useCallStore.getState();
        const currentStream = state.localStream;
        if (!currentStream || state.callType !== 'video' || state.isScreenSharing) return;

        const nextFacingMode = facingModeState === 'user' ? 'environment' : 'user';

        try {
            const nextStream = await getMedia(nextFacingMode, 'video');
            const newVideoTrack = nextStream.getVideoTracks()[0];
            const currentAudioTrack = currentStream.getAudioTracks()[0];

            if (!newVideoTrack) {
                stopTracks(nextStream);
                return;
            }

            await Promise.all(
                [...peerConnections.values()].map(async (pc) => {
                    const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(newVideoTrack);
                    }
                })
            );

            const mergedStream = new MediaStream([
                ...(currentAudioTrack ? [currentAudioTrack] : []),
                newVideoTrack,
            ]);

            useCallStore.getState().setLocalStream(mergedStream);
            currentStream.getVideoTracks().forEach((track) => track.stop());
            nextStream.getAudioTracks().forEach((track) => track.stop());

            facingModeState = nextFacingMode;
            setFacingMode(nextFacingMode);
        } catch (error) {
            console.error('Failed to switch camera:', error);
        }
    }, [getMedia]);

    const stopScreenShare = useCallback(async () => {
        const state = useCallStore.getState();
        if (!state.isScreenSharing || state.callType !== 'video') return;

        try {
            const cameraStream = await getMedia(facingModeState, 'video');
            const cameraTrack = cameraStream.getVideoTracks()[0];
            const currentAudioTrack = state.localStream?.getAudioTracks?.()[0];

            if (!cameraTrack) {
                stopTracks(cameraStream);
                return;
            }

            await Promise.all(
                [...peerConnections.values()].map(async (pc) => {
                    const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(cameraTrack);
                    }
                })
            );

            const mergedStream = new MediaStream([
                ...(currentAudioTrack ? [currentAudioTrack] : []),
                cameraTrack,
            ]);

            useCallStore.getState().setLocalStream(mergedStream);
            useCallStore.getState().setScreenSharing(false);
            stopScreenShareStream();
            state.localStream?.getVideoTracks?.().forEach((track) => track.stop());
            cameraStream.getAudioTracks().forEach((track) => track.stop());
        } catch (error) {
            console.error('Failed to stop screen share:', error);
        }
    }, [getMedia]);

    const toggleScreenShare = useCallback(async () => {
        const state = useCallStore.getState();
        if (state.callType !== 'video' || !state.localStream) return;

        if (state.isScreenSharing) {
            await stopScreenShare();
            return;
        }

        try {
            if (!navigator.mediaDevices?.getDisplayMedia) {
                toast.error('Screen sharing is not supported in this browser');
                return;
            }

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            const screenTrack = displayStream.getVideoTracks()[0];
            const currentAudioTrack = state.localStream.getAudioTracks()[0];

            if (!screenTrack) {
                stopTracks(displayStream);
                return;
            }

            screenStream = displayStream;

            screenTrack.onended = () => {
                if (useCallStore.getState().isScreenSharing) {
                    stopScreenShare();
                }
            };

            await Promise.all(
                [...peerConnections.values()].map(async (pc) => {
                    const sender = pc.getSenders().find((item) => item.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(screenTrack);
                    }
                })
            );

            const mergedStream = new MediaStream([
                ...(currentAudioTrack ? [currentAudioTrack] : []),
                screenTrack,
            ]);

            useCallStore.getState().setLocalStream(mergedStream);
            useCallStore.getState().setScreenSharing(true);

            state.localStream.getVideoTracks().forEach((track) => track.stop());
        } catch (error) {
            if (error?.name !== 'NotAllowedError') {
                console.error('Failed to start screen share:', error);
                toast.error('Failed to share your screen');
            }
        }
    }, [stopScreenShare]);

    return {
        startCall,
        answerCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        switchCamera,
        facingMode,
    };
};

export default useWebRTC;
