// Full-screen and minimized call experience with WhatsApp-style controls

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronUp,
    Mic,
    MicOff,
    Minimize2,
    MonitorUp,
    PhoneOff,
    RefreshCcw,
    Users,
    Video,
    VideoOff,
} from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';
import useAuthStore from '../../store/useAuthStore';
import AvatarFallback from '../ui/AvatarFallback';

const formatDuration = (seconds = 0) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

function RemoteTile({ participant, isVideoCall, isCompact = false }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && participant?.stream) {
            videoRef.current.srcObject = participant.stream;
            videoRef.current.play().catch((error) => console.error('Remote video play error:', error));
        }
    }, [participant?.stream]);

    const showVideo = isVideoCall && participant?.stream && !participant?.isVideoOff;

    return (
        <div className={`relative overflow-hidden border border-white/10 bg-black/30 ${isCompact ? 'rounded-[26px] min-h-[180px]' : 'rounded-[32px] min-h-[220px]'}`}>
            {showVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(111,107,255,0.24),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))]">
                    <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/10">
                        {participant?.avatar ? (
                            <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                        ) : (
                            <AvatarFallback name={participant?.name} className="text-3xl" />
                        )}
                    </div>
                </div>
            )}

            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

            <div className="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-3">
                <div className="glass-card px-3.5 py-2.5 rounded-[20px] min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{participant?.name || 'Participant'}</p>
                    {participant?.username && (
                        <p className="text-[11px] text-white/45 truncate">@{participant.username}</p>
                    )}
                </div>

                <div className="glass-card px-3 py-2 rounded-[18px] flex items-center gap-2 text-white/75">
                    {participant?.isMuted ? <MicOff className="w-4 h-4 text-red-300" /> : <Mic className="w-4 h-4" />}
                    {isVideoCall && (participant?.isVideoOff ? <VideoOff className="w-4 h-4 text-red-300" /> : <Video className="w-4 h-4" />)}
                </div>
            </div>
        </div>
    );
}

function LocalPreview({ localVideoRef, localStream, isVideoCall, isVideoOff, isAudioMuted, isScreenSharing, minimized = false }) {
    return (
        <div className={`relative ${minimized ? 'w-16 h-16 rounded-2xl' : isVideoCall ? 'w-24 h-32 sm:w-32 sm:h-44 md:w-40 md:h-52 rounded-[24px] sm:rounded-[28px]' : 'w-20 h-20 sm:w-24 sm:h-24 rounded-[24px] sm:rounded-[28px]'} overflow-hidden ring-2 ring-white/15 shadow-2xl bg-black/35 backdrop-blur-md`}>
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
                        <div className="w-full h-full flex items-center justify-center bg-black/40">
                            <VideoOff className="w-7 h-7 text-white/35" />
                        </div>
                    )}
                    {isScreenSharing && !minimized && (
                        <div className="absolute top-2 left-2 badge-pill !bg-emerald-500/20 !text-emerald-200">
                            <MonitorUp className="w-3.5 h-3.5" />
                            Sharing
                        </div>
                    )}
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-white bg-white/10">
                    <Mic className="w-10 h-10" />
                </div>
            )}

            {!minimized && (
                <div className="absolute bottom-2 right-2 glass-card px-2.5 py-1 rounded-full flex items-center gap-1 text-[11px] text-white/75">
                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5 text-red-300" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>You</span>
                </div>
            )}
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
        chatAvatar,
        isMinimized,
        showParticipants,
        callStartedAt,
        setMinimized,
        setShowParticipants,
    } = useCallStore();
    const { user } = useAuthStore();
    const { endCall, toggleAudio, toggleVideo, toggleScreenShare, switchCamera } = useWebRTC();
    const localVideoRef = useRef(null);
    const [durationSeconds, setDurationSeconds] = useState(0);

    const participantList = useMemo(() => Object.values(remoteParticipants || {}), [remoteParticipants]);
    const title = callMode === 'group' ? (chatName || 'Group Call') : (callerInfo?.name || 'Call');
    const avatar = callMode === 'group' ? chatAvatar : callerInfo?.avatar;
    const isVideoCall = callType === 'video';
    const isConnected = isInCall;
    const participantCount = participantList.length + 1;
    const statusLabel = isConnected
        ? (callMode === 'group' ? `${participantCount} participants` : formatDuration(durationSeconds))
        : (callMode === 'group'
            ? (participantList.length ? 'Connecting participants...' : 'Calling group...')
            : 'Ringing...');

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch((error) => console.error('Local video play error:', error));
        }
    }, [localStream]);

    useEffect(() => {
        if (!callStartedAt) {
            setDurationSeconds(0);
            return;
        }

        const update = () => setDurationSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
        update();
        const timer = window.setInterval(update, 1000);
        return () => window.clearInterval(timer);
    }, [callStartedAt]);

    if (!isInCall && !isCalling) return null;

    if (isMinimized) {
        return (
            <button
                onClick={() => setMinimized(false)}
                className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-auto z-50 surface-elevated px-4 py-3 flex items-center gap-3 min-w-0 sm:min-w-[220px] text-left"
            >
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10">
                        {avatar ? (
                            <img src={avatar} alt={title} className="w-full h-full object-cover" />
                        ) : (
                            <AvatarFallback
                                name={title}
                                className="text-lg"
                                variant={callMode === 'group' ? 'group' : 'person'}
                                icon={callMode === 'group' ? <Users className="w-5 h-5" /> : null}
                            />
                        )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f1320]" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{title}</p>
                    <p className="text-xs opacity-60 truncate">
                        {isConnected ? `${isVideoCall ? 'Video' : 'Audio'} call • ${formatDuration(durationSeconds)}` : statusLabel}
                    </p>
                </div>

                <LocalPreview
                    localVideoRef={localVideoRef}
                    localStream={localStream}
                    isVideoCall={isVideoCall}
                    isVideoOff={isVideoOff}
                    isAudioMuted={isAudioMuted}
                    isScreenSharing={isScreenSharing}
                    minimized
                />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-[#05070d] via-[#0c1220] to-[#151f2c]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(111,107,255,0.32),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.15),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.14),_transparent_28%)]" />

            <div className="relative z-10 h-full flex flex-col p-3 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="glass-card rounded-[24px] sm:rounded-[28px] px-4 py-3 flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10">
                            {avatar ? (
                                <img src={avatar} alt={title} className="w-full h-full object-cover" />
                            ) : (
                                <AvatarFallback
                                    name={title}
                                    className="text-xl"
                                    variant={callMode === 'group' ? 'group' : 'person'}
                                    icon={callMode === 'group' ? <Users className="w-6 h-6" /> : null}
                                />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-base sm:text-lg font-semibold truncate text-white">{title}</p>
                            <div className="flex items-center gap-2 text-xs text-white/60">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <span>{statusLabel}</span>
                                {isScreenSharing && <span className="badge-pill !bg-emerald-500/15 !text-emerald-200">Sharing screen</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            onClick={() => setShowParticipants(!showParticipants)}
                            className="icon-button text-white"
                            title="Participants"
                        >
                            <Users className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setMinimized(true)}
                            className="icon-button text-white"
                            title="Minimize"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="relative flex-1 min-h-0">
                    {participantList.length > 0 ? (
                        <div className={`grid h-full gap-3 sm:gap-4 ${participantList.length === 1 ? 'grid-cols-1' : participantList.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                            {participantList.map((participant) => (
                                <RemoteTile
                                    key={participant.userId}
                                    participant={participant}
                                    isVideoCall={isVideoCall}
                                    isCompact={participantList.length > 3}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center max-w-sm px-6">
                                <div className="w-28 h-28 mx-auto rounded-full overflow-hidden ring-4 ring-white/10 mb-6">
                                    {avatar ? (
                                        <img src={avatar} alt={title} className="w-full h-full object-cover" />
                                    ) : (
                                        <AvatarFallback
                                            name={title}
                                            className="text-4xl"
                                            variant={callMode === 'group' ? 'group' : 'person'}
                                            icon={callMode === 'group' ? <Users className="w-12 h-12" /> : null}
                                        />
                                    )}
                                </div>
                                <p className="text-white text-xl font-semibold mb-2">{title}</p>
                                <p className="text-white/55 text-sm">{statusLabel}</p>
                            </div>
                        </div>
                    )}

                    <div className="absolute top-3 right-0 sm:right-2 md:right-4 z-20">
                        <LocalPreview
                            localVideoRef={localVideoRef}
                            localStream={localStream}
                            isVideoCall={isVideoCall}
                            isVideoOff={isVideoOff}
                            isAudioMuted={isAudioMuted}
                            isScreenSharing={isScreenSharing}
                        />
                    </div>

                    {showParticipants && (
                        <div className="absolute left-0 right-0 bottom-0 sm:left-auto sm:top-0 sm:right-0 sm:bottom-0 z-30 w-full sm:max-w-[320px] glass-card rounded-t-[30px] sm:rounded-[30px] p-4 sm:p-5 overflow-y-auto max-h-[46vh] sm:max-h-none">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-semibold text-white">Participants</p>
                                    <p className="text-xs text-white/45">{participantCount} in this call</p>
                                </div>
                                <button
                                    onClick={() => setShowParticipants(false)}
                                    className="icon-button text-white"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div className="surface-muted p-3 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10">
                                        {user?.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <AvatarFallback name={user?.name || 'You'} className="text-lg" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-white">You</p>
                                        <p className="text-xs text-white/45">
                                            {isAudioMuted ? 'Muted' : 'Mic on'} • {isVideoCall ? (isVideoOff ? 'Camera off' : 'Camera on') : 'Audio only'}
                                        </p>
                                    </div>
                                </div>

                                {participantList.map((participant) => (
                                    <div key={participant.userId} className="surface-muted p-3 flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10">
                                            {participant.avatar ? (
                                                <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <AvatarFallback name={participant.name} className="text-lg" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">{participant.name}</p>
                                            <p className="text-xs text-white/45 truncate">
                                                {participant.isMuted ? 'Muted' : 'Mic on'} • {isVideoCall ? (participant.isVideoOff ? 'Camera off' : 'Camera on') : 'Audio only'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center mt-4">
                    <div className="glass-card rounded-[28px] sm:rounded-[32px] px-3 sm:px-4 py-3 flex items-center justify-center flex-wrap gap-2 sm:gap-3 max-w-full">
                        <button
                            onClick={toggleAudio}
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500 text-white shadow-[0_12px_24px_rgba(239,68,68,0.28)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                        >
                            {isAudioMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </button>

                        {isVideoCall && (
                            <button
                                onClick={toggleVideo}
                                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white shadow-[0_12px_24px_rgba(239,68,68,0.28)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                            >
                                {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </button>
                        )}

                        {isVideoCall && (
                            <button
                                onClick={toggleScreenShare}
                                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,0.28)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
                            >
                                <MonitorUp className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        )}

                        {isVideoCall && (
                            <button
                                onClick={switchCamera}
                                disabled={isScreenSharing}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                                title="Switch camera"
                            >
                                <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        )}

                        <button
                            onClick={endCall}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-[0_18px_34px_rgba(239,68,68,0.34)]"
                            title="End call"
                        >
                            <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
