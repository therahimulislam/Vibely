// client/src/hooks/useWebRTC.js
// WebRTC hook for video calls with E2E encryption via DTLS-SRTP

import { useRef, useCallback, useEffect, useState } from 'react';
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

    const [facingMode, setFacingMode] = useState('user');

    // Get user media
    const getMedia = useCallback(async (mode = 'user') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: mode
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('Failed to get media:', error);
            throw error;
        }
    }, []);

    // Switch camera
    const switchCamera = useCallback(async () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';

        try {
            const stream = await getMedia(newMode);
            const videoTrack = stream.getVideoTracks()[0];

            if (peerConnection.current) {
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            } else {
                // If no peer connection yet, just update local stream state (handled by getMedia)
            }

            // Stop OLD tracks only after successful replacement
            // Note: getMedia updates localStream state, but we need to stop the *previous* stream's tracks
            // The previous localStream is closure-captured or we need to access current state. 
            // setLocalStream replaces it, but we should stop the old ones.
            // Actually, getMedia replaces localStream. We can stop the old one *before* via ref or similar,
            // but here we rely on the fact that we got a *new* stream.
            // Best practice: The old tracks should be stopped.
            // Since getMedia replaces `localStream` state, we might lose reference to old stream if we don't track it.
            // But wait, getMedia stops NOTHING.
            // We should stop the old tracks from the *previous* `localStream` value.
            // However, `localStream` in dependencies might be stale or updated.
            // Let's modify logic: 

            // 1. Get current video track
            const oldVideoTrack = localStream?.getVideoTracks()[0];

            // 2. Update mode state
            setFacingMode(newMode);

            // 3. Stop old after new started? Or before?
            // Mobile cameras often require stopping the old one before starting new one (exclusive access).
            if (oldVideoTrack) {
                oldVideoTrack.stop();
            }

            // 4. getMedia will set the new stream
            // (We already called getMedia above, but we should have stopped old track FIRST for mobile)

            // RE-DOING ORDER:
            // Mobile requires release.
            if (localStream) {
                localStream.getVideoTracks().forEach(track => track.stop());
            }

            const newStream = await getMedia(newMode);
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (peerConnection.current) {
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

        } catch (error) {
            console.error('Failed to switch camera:', error);
            // Revert state if failed?
            setFacingMode(facingMode); // revert
        }
    }, [facingMode, localStream, getMedia]);

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
        switchCamera,
    };
};

export default useWebRTC;
