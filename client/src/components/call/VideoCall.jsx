// client/src/components/call/VideoCall.jsx
// Full-screen video call overlay

import { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';

export default function VideoCall() {
    const { isInCall, isCalling, localStream, remoteStream, isAudioMuted, isVideoOff, callerInfo } = useCallStore();
    const { endCall, toggleAudio, toggleVideo } = useWebRTC();
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    if (!isInCall && !isCalling) return null;

    return (
        <div className="call-overlay animate-fade-in">
            {/* Remote video (full screen) */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Calling state */}
            {isCalling && !isInCall && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-6 ring-4 ring-primary-500/30 animate-pulse-soft">
                        {callerInfo?.avatar ? (
                            <img src={callerInfo.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                                style={{ background: 'var(--gradient-primary)' }}>
                                ?
                            </div>
                        )}
                    </div>
                    <p className="text-white text-lg font-semibold mb-2">Calling...</p>
                    <p className="text-white/50 text-sm">Waiting for answer</p>
                </div>
            )}

            {/* Local video (picture-in-picture) */}
            <div className="absolute top-4 right-4 w-36 h-48 rounded-2xl overflow-hidden ring-2 ring-white/20 z-20 shadow-2xl">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                    <div className="w-full h-full flex items-center justify-center bg-surface-900">
                        <VideoOff className="w-8 h-8 text-white/30" />
                    </div>
                )}
            </div>

            {/* E2E encryption badge */}
            <div className="absolute top-4 left-4 z-20 glass-card px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-white/70">End-to-end encrypted</span>
            </div>

            {/* Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                <button
                    onClick={toggleAudio}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                >
                    {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                >
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>

                <button
                    onClick={endCall}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
                >
                    <PhoneOff className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
