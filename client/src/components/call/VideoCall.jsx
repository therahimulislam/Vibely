// client/src/components/call/VideoCall.jsx
// Full-screen overlay for direct and group audio/video calls

import { useRef, useEffect } from 'react';
import { Mic, MicOff, MonitorUp, PhoneOff, RefreshCcw, Users, Video, VideoOff } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';

function ParticipantTile({ participant, isVideoCall }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && participant?.stream) {
            videoRef.current.srcObject = participant.stream;
            videoRef.current.play().catch((error) => console.error('Remote video play error:', error));
        }
    }, [participant?.stream]);

    const showVideo = isVideoCall && participant?.stream && !participant?.isVideoOff;

    return (
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black/20 min-h-[220px]">
            {showVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                    <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/10">
                        {participant?.avatar ? (
                            <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold bg-white/10">
                                {participant?.name?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="absolute left-4 right-4 bottom-4 flex items-center justify-between gap-3">
                <div className="glass-card px-3 py-2 rounded-2xl">
                    <p className="text-sm font-semibold text-white truncate">{participant?.name || 'Participant'}</p>
                    {participant?.username && (
                        <p className="text-[11px] text-white/45 truncate">@{participant.username}</p>
                    )}
                </div>
                <div className="glass-card px-3 py-2 rounded-2xl flex items-center gap-2 text-white/70">
                    {participant?.isMuted ? <MicOff className="w-4 h-4 text-red-300" /> : <Mic className="w-4 h-4" />}
                    {isVideoCall && (participant?.isVideoOff ? <VideoOff className="w-4 h-4 text-red-300" /> : <Video className="w-4 h-4" />)}
                </div>
            </div>
        </div>
    );
}

export default function VideoCall() {
    const {
        isInCall,
        isCalling,
        localStream,
        remoteParticipants,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        callerInfo,
        callType,
        callMode,
        chatName,
    } = useCallStore();
    const { endCall, toggleAudio, toggleVideo, toggleScreenShare, switchCamera } = useWebRTC();
    const localVideoRef = useRef(null);

    const participantList = Object.values(remoteParticipants || {});
    const title = callMode === 'group' ? (chatName || 'Group Call') : (callerInfo?.name || 'Call');
    const isVideoCall = callType === 'video';
    const waitingLabel = callMode === 'group'
        ? (participantList.length ? 'Connecting everyone...' : 'Waiting for others to join')
        : 'Waiting for answer';

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch((error) => console.error('Local video play error:', error));
        }
    }, [localStream]);

    if (!isInCall && !isCalling) return null;

    return (
        <div className="call-overlay animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-[#09090f] via-[#161229] to-[#102227]" />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,92,252,0.35),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(71,202,183,0.2),_transparent_35%)]" />

            <div className="absolute top-4 left-4 z-20 glass-card px-4 py-2 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-white/70">End-to-end encrypted</span>
            </div>

            <div className="absolute top-4 right-4 z-20 glass-card px-4 py-2 rounded-full flex items-center gap-2 text-white/70">
                {callMode === 'group' && <Users className="w-4 h-4" />}
                <span className="text-xs">{callMode === 'group' ? `${participantList.length + 1} in call` : (isVideoCall ? 'Video call' : 'Audio call')}</span>
            </div>

            <div className="relative z-10 h-full flex flex-col p-4 md:p-6 pb-28">
                <div className="mb-4 text-center">
                    <h2 className="text-white text-2xl font-semibold">{title}</h2>
                    <p className="text-white/50 text-sm mt-1">{isCalling && !participantList.length ? waitingLabel : `${isVideoCall ? 'Video' : 'Audio'} call in progress`}</p>
                </div>

                {participantList.length > 0 ? (
                    <div className={`grid gap-3 sm:gap-4 flex-1 ${participantList.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {participantList.map((participant) => (
                            <ParticipantTile
                                key={participant.userId}
                                participant={participant}
                                isVideoCall={isVideoCall}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-sm">
                            <div className="w-28 h-28 mx-auto rounded-full overflow-hidden ring-4 ring-white/10 mb-6">
                                {callerInfo?.avatar ? (
                                    <img src={callerInfo.avatar} alt={title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/10 text-white">
                                        {callMode === 'group' ? <Users className="w-12 h-12" /> : <span className="text-4xl font-bold">{title?.[0]?.toUpperCase() || '?'}</span>}
                                    </div>
                                )}
                            </div>
                            <p className="text-white text-lg font-semibold mb-2">{title}</p>
                            <p className="text-white/50 text-sm">{waitingLabel}</p>
                        </div>
                    </div>
                )}

                <div className={`absolute ${isVideoCall ? 'top-24 right-3 sm:top-20 sm:right-4 md:right-6 w-24 h-32 sm:w-32 sm:h-44 md:w-40 md:h-52' : 'top-24 right-3 sm:right-4 w-20 h-20 sm:w-24 sm:h-24'} rounded-3xl overflow-hidden ring-2 ring-white/15 z-20 shadow-2xl bg-black/20`}>
                    {isVideoCall ? (
                        <>
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
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white bg-white/10">
                            <Mic className="w-10 h-10" />
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-4 px-3">
                <button
                    onClick={toggleAudio}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                    {isAudioMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>

                {isVideoCall && (
                    <button
                        onClick={toggleVideo}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>
                )}

                {isVideoCall && (
                    <button
                        onClick={toggleScreenShare}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    >
                        <MonitorUp className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                )}

                {isVideoCall && (
                    <button
                        onClick={switchCamera}
                        disabled={isScreenSharing}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    >
                        <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                )}

                <button
                    onClick={endCall}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
                >
                    <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
            </div>
        </div>
    );
}
