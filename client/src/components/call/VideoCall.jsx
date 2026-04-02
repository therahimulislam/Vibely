// client/src/components/call/VideoCall.jsx
// Premium WhatsApp-style video/audio call screen
// Features: draggable PiP that snaps to 4 corners, tap-to-swap main↔PiP

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Mic, MicOff, Minimize2, MonitorUp,
    PhoneOff, RefreshCcw, Users, Video,
    VideoOff, Volume2, X,
} from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';
import useAuthStore from '../../store/useAuthStore';
import AvatarFallback from '../ui/AvatarFallback';

/* ─── Helpers ─────────────────────────────────────── */
const fmt = (s = 0) => {
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    return h > 0 ? `${h}:${m}:${ss}` : `${m}:${ss}`;
};

/** Snap a point to the nearest of 4 corners inside a container */
const snapCorner = (x, y, containerW, containerH, itemW, itemH, margin = 12) => {
    const cx = x < containerW / 2 ? margin : containerW - itemW - margin;
    const cy = y < containerH / 2 ? margin : containerH - itemH - margin;
    return { x: cx, y: cy };
};

/* ─── Draggable PiP ───────────────────────────────── */
function DraggablePiP({
    localVideoRef, remoteVideoRef,
    isVideoCall, isVideoOff, isAudioMuted, isScreenSharing,
    localStream, remoteParticipant,
    isSwapped,      // true = PiP shows remote, main shows local
    onSwap,         // tap → swap
    containerRef,
}) {
    const pipW = 112, pipH = 152;  // px
    const [pos, setPos] = useState({ x: 12, y: 12 });   // top-right corner
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const dragStartRef = useRef(null);
    const posRef = useRef(pos);
    const pipRef = useRef(null);

    /** On first mount initialise to top-right */
    useEffect(() => {
        const snap = () => {
            if (!containerRef.current) return;
            const { width } = containerRef.current.getBoundingClientRect();
            const x = width - pipW - 12;
            setPos({ x, y: 12 });
            posRef.current = { x, y: 12 };
        };
        snap();
        window.addEventListener('resize', snap);
        return () => window.removeEventListener('resize', snap);
    }, []);

    const doSnap = useCallback((rawX, rawY) => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        const snapped = snapCorner(rawX, rawY, width, height, pipW, pipH);
        setIsAnimating(true);
        setPos(snapped);
        posRef.current = snapped;
        setTimeout(() => setIsAnimating(false), 380);
    }, []);

    /* ── Pointer events ── */
    const onPointerDown = (e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStartRef.current = {
            startX: e.clientX - posRef.current.x,
            startY: e.clientY - posRef.current.y,
            moved: false,
        };
        setIsDragging(true);
    };

    const onPointerMove = (e) => {
        if (!dragStartRef.current) return;
        const newX = e.clientX - dragStartRef.current.startX;
        const newY = e.clientY - dragStartRef.current.startY;
        const dx = Math.abs(newX - posRef.current.x);
        const dy = Math.abs(newY - posRef.current.y);
        if (dx > 4 || dy > 4) dragStartRef.current.moved = true;
        posRef.current = { x: newX, y: newY };
        setPos({ x: newX, y: newY });
    };

    const onPointerUp = (e) => {
        if (!dragStartRef.current) return;
        const wasTap = !dragStartRef.current.moved;
        dragStartRef.current = null;
        setIsDragging(false);
        if (wasTap) {
            onSwap();
        } else {
            doSnap(posRef.current.x, posRef.current.y);
        }
    };

    /* ── Show PiP content ── */
    const showPipVideo = isSwapped
        ? (isVideoCall && remoteParticipant?.stream && !remoteParticipant?.isVideoOff)
        : (isVideoCall && !isVideoOff);

    return (
        <div
            ref={pipRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute z-30 overflow-hidden cursor-pointer select-none"
            style={{
                width: pipW,
                height: pipH,
                left: pos.x,
                top: pos.y,
                borderRadius: 20,
                border: '2px solid rgba(255,255,255,0.18)',
                boxShadow: isDragging
                    ? '0 22px 52px rgba(0,0,0,0.75), 0 0 0 3px rgba(124,109,255,0.4)'
                    : '0 10px 36px rgba(0,0,0,0.65)',
                transition: isAnimating
                    ? 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), top 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease'
                    : isDragging
                    ? 'box-shadow 0.15s ease'
                    : 'box-shadow 0.2s ease',
                transform: isDragging ? 'scale(1.06)' : 'scale(1)',
                touchAction: 'none',
                background: 'rgba(10,12,22,0.9)',
                backdropFilter: 'blur(12px)',
            }}
            title="Drag to move • Tap to swap"
        >
            {/* PiP video content */}
            {showPipVideo ? (
                isSwapped
                    ? <RemoteVideoEl participant={remoteParticipant} />
                    : <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,109,255,0.18), transparent 70%)' }}>
                    {isSwapped
                        ? <AvatarFallback name={remoteParticipant?.name} className="text-xl" />
                        : (isVideoOff
                            ? <VideoOff className="w-7 h-7 text-white/30" />
                            : <Mic className="w-7 h-7 text-white/30" />)}
                </div>
            )}

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* Label badge */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white/80"
                    style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
                    {isSwapped ? (
                        <>
                            {remoteParticipant?.isMuted
                                ? <MicOff className="w-2.5 h-2.5 text-red-400" />
                                : <Mic className="w-2.5 h-2.5 text-emerald-400" />}
                            <span className="truncate max-w-[64px]">{remoteParticipant?.name || 'Them'}</span>
                        </>
                    ) : (
                        <>
                            {isAudioMuted ? <MicOff className="w-2.5 h-2.5 text-red-400" /> : <Mic className="w-2.5 h-2.5 text-emerald-400" />}
                            <span>You</span>
                        </>
                    )}
                </div>
            </div>

            {/* Tap-to-swap overlay hint — subtle arrows */}
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L1 4L3 6" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 8L9 6L7 4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 4H9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
            </div>

            {/* Drag handle dots */}
            {isDragging && (
                <div className="absolute inset-0 bg-primary-500/10 pointer-events-none" />
            )}

            {isScreenSharing && !isSwapped && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-emerald-500/80 text-[9px] text-white font-medium pointer-events-none">
                    Sharing
                </div>
            )}
        </div>
    );
}

/** Thin wrapper to bind remote stream to a video element inside PiP */
function RemoteVideoEl({ participant }) {
    const vRef = useRef(null);
    useEffect(() => {
        if (vRef.current && participant?.stream) {
            vRef.current.srcObject = participant.stream;
            vRef.current.play().catch(() => { });
        }
    }, [participant?.stream]);
    return <video ref={vRef} autoPlay playsInline className="w-full h-full object-cover" />;
}

/* ─── Main tile (full-screen) ─────────────────────── */
function MainTile({ participant, localVideoRef, isSwapped, isVideoCall, isVideoOff, isAudioMuted, localStream, isScreenSharing }) {
    const remoteRef = useRef(null);
    useEffect(() => {
        if (remoteRef.current && participant?.stream) {
            remoteRef.current.srcObject = participant.stream;
            remoteRef.current.play().catch(() => { });
        }
    }, [participant?.stream]);

    const showRemote = !isSwapped && isVideoCall && participant?.stream && !participant?.isVideoOff;
    const showLocal = isSwapped && isVideoCall && !isVideoOff;

    return (
        <div className="absolute inset-0 overflow-hidden">
            {showRemote && (
                <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            )}
            {showLocal && (
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            )}
            {!showRemote && !showLocal && (
                <div className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 50% 38%, rgba(124,109,255,0.22) 0%, transparent 65%)' }}>
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: 'rgba(124,109,255,0.12)', transform: 'scale(1.9)', animationDuration: '2.2s' }} />
                        <div className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: 'rgba(124,109,255,0.07)', transform: 'scale(2.6)', animationDuration: '2.2s', animationDelay: '0.65s' }} />
                        <div className="relative w-32 h-32 rounded-full overflow-hidden"
                            style={{ boxShadow: '0 0 0 3.5px rgba(124,109,255,0.4), 0 24px 64px rgba(0,0,0,0.6)' }}>
                            {(isSwapped ? (participant?.avatar) : participant?.avatar)
                                ? <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                                : <AvatarFallback name={isSwapped ? 'You' : participant?.name} className="text-4xl" />}
                        </div>
                    </div>
                    <p className="text-white text-xl font-bold mt-6 mb-1">{isSwapped ? 'You' : (participant?.name || 'Participant')}</p>
                    {isSwapped && isVideoOff && <p className="text-white/45 text-sm">Camera off</p>}
                </div>
            )}

            {/* Gradient overlays */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

            {/* Main name bar */}
            {participant && (
                <div className="absolute bottom-6 left-4 right-4 flex items-end justify-between pointer-events-none">
                    <div className="px-3.5 py-2 rounded-[16px]"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)' }}>
                        <p className="text-[14px] font-semibold text-white">
                            {isSwapped ? 'You' : (participant?.name || 'Participant')}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-[14px]"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)' }}>
                        {(isSwapped ? isAudioMuted : participant?.isMuted)
                            ? <MicOff className="w-4 h-4 text-red-400" />
                            : <Mic className="w-4 h-4 text-emerald-400" />}
                        {isVideoCall && ((isSwapped ? isVideoOff : participant?.isVideoOff)
                            ? <VideoOff className="w-4 h-4 text-red-400" />
                            : <Video className="w-4 h-4 text-white/50" />)}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Control button ───────────────────────────────── */
function CtrlBtn({ icon, label, active, activeRed = false, activeGreen = false, onClick, disabled, big = false }) {
    const bg = active
        ? activeRed
            ? { background: 'rgba(239,68,68,0.85)', boxShadow: '0 8px 22px rgba(239,68,68,0.4)' }
            : activeGreen
            ? { background: 'rgba(16,185,129,0.85)', boxShadow: '0 8px 22px rgba(16,185,129,0.4)' }
            : { background: 'rgba(239,68,68,0.75)' }
        : { background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(12px)' };
    return (
        <div className="flex flex-col items-center gap-1.5">
            <button
                onClick={onClick}
                disabled={disabled}
                className={`${big ? 'w-16 h-16 sm:w-[68px] sm:h-[68px]' : 'w-12 h-12 sm:w-[52px] sm:h-[52px]'} rounded-full flex items-center justify-center transition-transform duration-150 active:scale-90 disabled:opacity-40`}
                style={bg}
            >
                <span className="text-white">{icon}</span>
            </button>
            {label && <span className="text-white/55 text-[11px] font-medium">{label}</span>}
        </div>
    );
}

/* ─── Main VideoCall ───────────────────────────────── */
export default function VideoCall() {
    const {
        isInCall, isCalling, localStream, remoteParticipants,
        isAudioMuted, isVideoOff, isScreenSharing,
        callerInfo, callType, callMode, chatName, chatAvatar,
        isMinimized, showParticipants, callStartedAt,
        setMinimized, setShowParticipants,
    } = useCallStore();
    const { user } = useAuthStore();
    const { endCall, toggleAudio, toggleVideo, toggleScreenShare, switchCamera } = useWebRTC();
    const localVideoRef = useRef(null);
    const containerRef = useRef(null);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isSwapped, setIsSwapped] = useState(false);   // PiP ↔ main swap
    const hideTimer = useRef(null);

    const participantList = useMemo(() => Object.values(remoteParticipants || {}), [remoteParticipants]);
    const primaryParticipant = participantList[0] || null;
    const title = callMode === 'group' ? (chatName || 'Group Call') : (callerInfo?.name || 'Call');
    const avatar = callMode === 'group' ? chatAvatar : callerInfo?.avatar;
    const isVideoCall = callType === 'video';
    const isConnected = isInCall;
    const statusLabel = isConnected
        ? (callMode === 'group' ? `${participantList.length + 1} in call • ${fmt(durationSeconds)}` : fmt(durationSeconds))
        : (participantList.length ? 'Connecting...' : 'Ringing...');

    // Bind local video for non-swapped case
    useEffect(() => {
        if (localVideoRef.current && localStream && !isSwapped) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => { });
        }
    }, [localStream, isSwapped]);

    // Duration timer
    useEffect(() => {
        if (!callStartedAt) { setDurationSeconds(0); return; }
        const upd = () => setDurationSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
        upd();
        const t = setInterval(upd, 1000);
        return () => clearInterval(t);
    }, [callStartedAt]);

    // Auto-hide controls
    const resetHide = useCallback(() => {
        setShowControls(true);
        clearTimeout(hideTimer.current);
        if (isVideoCall && isConnected && participantList.length > 0) {
            hideTimer.current = setTimeout(() => setShowControls(false), 4500);
        }
    }, [isVideoCall, isConnected, participantList.length]);
    useEffect(() => { resetHide(); return () => clearTimeout(hideTimer.current); }, [resetHide]);

    if (!isInCall && !isCalling) return null;

    // ── Minimized pill ──────────────────────────────
    if (isMinimized) {
        return (
            <button
                onClick={() => setMinimized(false)}
                className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-5 sm:w-auto z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                    background: 'rgba(14,17,32,0.92)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
            >
                <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/10">
                        {avatar
                            ? <img src={avatar} alt={title} className="w-full h-full object-cover" />
                            : <AvatarFallback name={title} className="text-base" variant={callMode === 'group' ? 'group' : 'person'} icon={callMode === 'group' ? <Users className="w-4 h-4" /> : null} />}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#0e1120]" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{title}</p>
                    <p className="text-xs text-white/50">
                        {isConnected ? `${isVideoCall ? '📹' : '📞'} ${fmt(durationSeconds)}` : statusLabel}
                    </p>
                </div>
                <button
                    className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 active:scale-90"
                    style={{ boxShadow: '0 4px 14px rgba(239,68,68,0.55)' }}
                    onClick={(e) => { e.stopPropagation(); endCall(); }}
                >
                    <PhoneOff className="w-4 h-4 text-white" />
                </button>
            </button>
        );
    }

    // ── Full-screen ─────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-50 flex flex-col select-none animate-fade-in overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #050810 0%, #0a0d1c 50%, #060912 100%)' }}
            onClick={resetHide}
        >
            {/* Aurora atmosphere */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[130px] opacity-20"
                    style={{ background: 'radial-gradient(circle, #7c6dff, transparent)' }} />
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-12"
                    style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
            </div>

            {/* ── Main video area (fills screen) ── */}
            {(participantList.length > 0 || isVideoCall) ? (
                /* Show main tile with swap logic */
                <div className="absolute inset-0">
                    {participantList.length > 1 ? (
                        /* Multi-person grid (no PiP swap on group) */
                        <div className={`h-full p-2 grid gap-2 ${participantList.length === 2 ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-2'}`}>
                            {participantList.map(p => (
                                <div key={p.userId} className="relative overflow-hidden rounded-[24px]">
                                    <RemoteMultiTile participant={p} isVideoCall={isVideoCall} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* 1-on-1: swappable main tile */
                        <MainTile
                            participant={primaryParticipant}
                            localVideoRef={localVideoRef}
                            isSwapped={isSwapped}
                            isVideoCall={isVideoCall}
                            isVideoOff={isVideoOff}
                            isAudioMuted={isAudioMuted}
                            localStream={localStream}
                        />
                    )}
                </div>
            ) : (
                /* Ringing / waiting */
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: 'rgba(124,109,255,0.12)', transform: 'scale(1.8)', animationDuration: '2.2s' }} />
                        <div className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: 'rgba(124,109,255,0.07)', transform: 'scale(2.5)', animationDuration: '2.2s', animationDelay: '0.6s' }} />
                        <div className="relative w-32 h-32 rounded-full overflow-hidden"
                            style={{ boxShadow: '0 0 0 3px rgba(124,109,255,0.4), 0 20px 60px rgba(0,0,0,0.6)' }}>
                            {avatar
                                ? <img src={avatar} alt={title} className="w-full h-full object-cover" />
                                : <AvatarFallback name={title} className="text-4xl" variant={callMode === 'group' ? 'group' : 'person'} icon={callMode === 'group' ? <Users className="w-12 h-12" /> : null} />}
                        </div>
                    </div>
                    <p className="text-white text-2xl font-bold mb-1">{title}</p>
                    <p className="text-white/50 text-sm">{statusLabel}</p>
                    {!isVideoCall && isConnected && (
                        <div className="flex items-end gap-1 mt-5 h-8">
                            {[...Array(7)].map((_, i) => (
                                <div key={i} className="w-1 rounded-full bg-primary-400/60 waveform-bar"
                                    style={{ animationDelay: `${i * 0.12}s` }} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Draggable PiP (1-on-1 only) ── */}
            {participantList.length === 1 && (isVideoCall || primaryParticipant) && (
                <DraggablePiP
                    localVideoRef={isSwapped ? undefined : localVideoRef}
                    remoteParticipant={primaryParticipant}
                    isVideoCall={isVideoCall}
                    isVideoOff={isVideoOff}
                    isAudioMuted={isAudioMuted}
                    isScreenSharing={isScreenSharing}
                    localStream={localStream}
                    isSwapped={isSwapped}
                    onSwap={() => setIsSwapped(s => !s)}
                    containerRef={containerRef}
                />
            )}

            {/* ── Top bar ── */}
            <div className={`absolute top-0 left-0 right-0 z-20 transition-all duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center justify-between px-4 pt-12 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden ring-[1.5px] ring-white/15 flex-shrink-0">
                            {avatar
                                ? <img src={avatar} alt={title} className="w-full h-full object-cover" />
                                : <AvatarFallback name={title} className="text-sm" variant={callMode === 'group' ? 'group' : 'person'} icon={callMode === 'group' ? <Users className="w-4 h-4" /> : null} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{title}</p>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <span className="text-white/50 text-xs">{statusLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {callMode === 'group' && (
                            <button onClick={() => setShowParticipants(v => !v)}
                                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
                                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
                                <Users className="w-4 h-4 text-white/75" />
                            </button>
                        )}
                        <button onClick={() => setMinimized(true)}
                            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
                            style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
                            <Minimize2 className="w-4 h-4 text-white/75" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Participants panel ── */}
            {showParticipants && (
                <div className="absolute inset-y-0 right-0 z-40 w-full sm:max-w-[280px] flex flex-col animate-slide-in-right"
                    style={{ background: 'rgba(8,10,20,0.92)', backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/8">
                        <div>
                            <p className="text-sm font-semibold text-white">Participants</p>
                            <p className="text-xs text-white/40 mt-0.5">{participantList.length + 1} in call</p>
                        </div>
                        <button onClick={() => setShowParticipants(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/5">
                            <X className="w-4 h-4 text-white/60" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        <ParticipantRow name="You" avatar={user?.avatar} isMuted={isAudioMuted} isVideoOff={isVideoOff} isVideoCall={isVideoCall} />
                        {participantList.map(p => (
                            <ParticipantRow key={p.userId} name={p.name} avatar={p.avatar} isMuted={p.isMuted} isVideoOff={p.isVideoOff} isVideoCall={isVideoCall} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Bottom controls ── */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-500 ${(showControls || !isVideoCall) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
                <div className="px-5 pb-10 pt-4 flex flex-col items-center gap-3">
                    {/* Swap hint */}
                    {participantList.length === 1 && isVideoCall && isConnected && (
                        <p className="text-white/30 text-[11px] mb-1">Tap the small box to swap views</p>
                    )}

                    <div className="flex items-center justify-center gap-4 sm:gap-5 px-5 py-4 rounded-[36px]"
                        style={{
                            background: 'rgba(12,15,28,0.78)',
                            backdropFilter: 'blur(28px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 -4px 40px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)',
                        }}>

                        <CtrlBtn
                            icon={isAudioMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                            label={isAudioMuted ? 'Muted' : 'Mute'}
                            active={isAudioMuted} activeRed
                            onClick={toggleAudio}
                        />

                        {isVideoCall && (
                            <CtrlBtn
                                icon={isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                                label={isVideoOff ? 'Cam off' : 'Camera'}
                                active={isVideoOff} activeRed
                                onClick={toggleVideo}
                            />
                        )}

                        {!isVideoCall && (
                            <CtrlBtn
                                icon={<Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
                                label="Speaker"
                                active={false}
                                onClick={() => { }}
                            />
                        )}

                        {/* END CALL — always center, big */}
                        <div className="flex flex-col items-center gap-1.5">
                            <button
                                onClick={endCall}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                                style={{
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    boxShadow: '0 10px 30px rgba(239,68,68,0.55)',
                                }}
                            >
                                <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                            </button>
                            <span className="text-white/50 text-[11px] font-medium">End</span>
                        </div>

                        {isVideoCall && (
                            <CtrlBtn
                                icon={<MonitorUp className="w-5 h-5 sm:w-6 sm:h-6" />}
                                label={isScreenSharing ? 'Stop' : 'Share'}
                                active={isScreenSharing} activeGreen
                                onClick={toggleScreenShare}
                            />
                        )}

                        {isVideoCall && (
                            <CtrlBtn
                                icon={<RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                                label="Flip"
                                active={false}
                                onClick={switchCamera}
                                disabled={isScreenSharing}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Helpers ─────────────────────────────────────── */
function ParticipantRow({ name, avatar, isMuted, isVideoOff, isVideoCall }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : <AvatarFallback name={name} className="text-sm" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{name}</p>
                <p className="text-xs text-white/40">{isMuted ? 'Muted' : 'Speaking'}</p>
            </div>
            <div className="flex gap-1.5">
                {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                {isVideoCall && (isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-400" /> : <Video className="w-3.5 h-3.5 text-white/35" />)}
            </div>
        </div>
    );
}

function RemoteMultiTile({ participant, isVideoCall }) {
    const vRef = useRef(null);
    useEffect(() => {
        if (vRef.current && participant?.stream) {
            vRef.current.srcObject = participant.stream;
            vRef.current.play().catch(() => { });
        }
    }, [participant?.stream]);

    const show = isVideoCall && participant?.stream && !participant?.isVideoOff;
    return (
        <div className="absolute inset-0 overflow-hidden bg-black/40">
            {show
                ? <video ref={vRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,109,255,0.18), transparent 70%)' }}>
                    <AvatarFallback name={participant?.name} className="text-2xl" />
                  </div>}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-[10px] text-[11px] text-white font-medium"
                style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(10px)' }}>
                {participant?.name}
            </div>
        </div>
    );
}
