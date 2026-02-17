// client/src/hooks/useWebRTC.js
// WebRTC hook for video calls with E2E encryption via DTLS-SRTP

import { useRef, useCallback, useEffect } from 'react';
import { getSocket } from './useSocket';
import useCallStore from '../store/useCallStore';
import useAuthStore from '../store/useAuthStore';
import { STUN_SERVERS } from '../utils/constants';

const useWebRTC = () => {
    const peerConnection = useRef(null);
    const {
        isCalling,
        isReceivingCall,
        recipientId,
        callerId,
        offer,
        localStream,
        setLocalStream,
        setRemoteStream,
        callConnected,
        endCall,
        isAudioMuted,
        isVideoOff,
    } = useCallStore();
    const { user } = useAuthStore();

    // Get user media
    const getMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Failed to get media:', error);
            throw error;
        }
    }, []);

    // Create peer connection
    const createPeerConnection = useCallback((stream) => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        // Add local tracks
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
            const remoteStream = new MediaStream();
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
            setRemoteStream(remoteStream);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const socket = getSocket();
                const targetId = recipientId || callerId;
                socket?.emit('iceCandidate', {
                    recipientId: targetId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                callConnected();
            }
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                handleEndCall();
            }
        };

        peerConnection.current = pc;
        return pc;
    }, [recipientId, callerId]);

    // Start outgoing call
    const startCall = useCallback(async (targetId) => {
        try {
            useCallStore.getState().startCall(targetId);
            const stream = await getMedia();
            const pc = createPeerConnection(stream);

            const offerSDP = await pc.createOffer();
            await pc.setLocalDescription(offerSDP);

            const socket = getSocket();
            socket?.emit('callUser', {
                recipientId: targetId,
                offer: offerSDP,
                callerInfo: { name: user?.name, avatar: user?.avatar },
            });
        } catch (error) {
            console.error('Failed to start call:', error);
            endCall();
        }
    }, [user]);

    // Answer incoming call
    const answerCall = useCallback(async () => {
        try {
            const stream = await getMedia();
            const pc = createPeerConnection(stream);

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answerSDP = await pc.createAnswer();
            await pc.setLocalDescription(answerSDP);

            const socket = getSocket();
            socket?.emit('answerCall', {
                callerId: callerId,
                answer: answerSDP,
            });

            callConnected();
        } catch (error) {
            console.error('Failed to answer call:', error);
            endCall();
        }
    }, [offer, callerId]);

    // Reject incoming call
    const rejectCall = useCallback(() => {
        const socket = getSocket();
        socket?.emit('rejectCall', { callerId });
        endCall();
    }, [callerId]);

    // End call
    const handleEndCall = useCallback(() => {
        const socket = getSocket();
        const targetId = recipientId || callerId;
        socket?.emit('endCall', { recipientId: targetId });

        peerConnection.current?.close();
        peerConnection.current = null;
        endCall();
    }, [recipientId, callerId]);

    // Toggle audio
    const toggleAudio = useCallback(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            useCallStore.getState().toggleAudio();

            const socket = getSocket();
            const targetId = recipientId || callerId;
            socket?.emit('toggleMedia', {
                recipientId: targetId,
                type: 'audio',
                enabled: localStream.getAudioTracks()[0]?.enabled,
            });
        }
    }, [localStream, recipientId, callerId]);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (localStream) {
            localStream.getVideoTracks().forEach((track) => {
                track.enabled = !track.enabled;
            });
            useCallStore.getState().toggleVideo();

            const socket = getSocket();
            const targetId = recipientId || callerId;
            socket?.emit('toggleMedia', {
                recipientId: targetId,
                type: 'video',
                enabled: localStream.getVideoTracks()[0]?.enabled,
            });
        }
    }, [localStream, recipientId, callerId]);

    // Listen for call answer and ICE candidates
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleCallAnswered = async ({ answer }) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(
                    new RTCSessionDescription(answer)
                );
            }
        };

        const handleIceCandidate = async ({ candidate }) => {
            if (peerConnection.current && candidate) {
                try {
                    await peerConnection.current.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
                } catch (error) {
                    console.error('ICE candidate error:', error);
                }
            }
        };

        const handleCallEnded = () => {
            peerConnection.current?.close();
            peerConnection.current = null;
            endCall();
        };

        socket.on('callAnswered', handleCallAnswered);
        socket.on('iceCandidate', handleIceCandidate);
        socket.on('callEnded', handleCallEnded);

        return () => {
            socket.off('callAnswered', handleCallAnswered);
            socket.off('iceCandidate', handleIceCandidate);
            socket.off('callEnded', handleCallEnded);
        };
    }, [isCalling, isReceivingCall]);

    return {
        startCall,
        answerCall,
        rejectCall,
        endCall: handleEndCall,
        toggleAudio,
        toggleVideo,
    };
};

export default useWebRTC;
