// client/src/components/call/IncomingCall.jsx
// WhatsApp-style premium incoming call screen

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, Users } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';
import AvatarFallback from '../ui/AvatarFallback';

export default function IncomingCall() {
    const { isReceivingCall, callerInfo, callType, callMode, chatName, chatAvatar } = useCallStore();
    const { answerCall, rejectCall } = useWebRTC();
    const audioRef = useRef(null);

    const title = callMode === 'group' ? (chatName || 'Group call') : (callerInfo?.name || 'Unknown');
    const subtitle = callMode === 'group'
        ? `${callerInfo?.name || 'Someone'} started a ${callType === 'audio' ? 'group audio' : 'group video'} call`
        : `Incoming ${callType === 'video' ? 'video' : 'audio'} call`;
    const avatar = callMode === 'group' ? chatAvatar : callerInfo?.avatar;
    const isVideo = callType === 'video';

    // Pulse ring effect without real audio (just UI)
    useEffect(() => {
        if (!isReceivingCall) return;
        // Visual-only: no actual ringtone needed unless implemented by user
    }, [isReceivingCall]);

    if (!isReceivingCall) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between animate-fade-in"
            style={{ background: 'linear-gradient(180deg, #0d0f1a 0%, #0a0c18 40%, #060810 100%)' }}>

            {/* Aurora blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full blur-[120px] opacity-25"
                    style={{ background: 'radial-gradient(circle, #7c6dff, transparent)' }} />
                <div className="absolute bottom-0 left-1/4 w-[320px] h-[320px] rounded-full blur-[110px] opacity-15"
                    style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />
            </div>

            {/* Top status */}
            <div className="relative z-10 pt-16 text-center px-6">
                <p className="text-sm text-white/45 mb-1 tracking-wider uppercase font-medium">
                    {isVideo ? 'Video' : 'Audio'} call
                </p>
            </div>

            {/* Center caller info */}
            <div className="relative z-10 flex flex-col items-center px-6">
                {/* Concentric pulse rings */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: 'rgba(124,109,255,0.12)', transform: 'scale(1.6)', animationDuration: '2s' }} />
                    <div className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: 'rgba(124,109,255,0.08)', transform: 'scale(2.1)', animationDuration: '2s', animationDelay: '0.5s' }} />

                    <div className="relative w-32 h-32 rounded-full overflow-hidden ring-4"
                        style={{ boxShadow: '0 0 0 4px rgba(124,109,255,0.35), 0 20px 60px rgba(0,0,0,0.5)' }}>
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
                </div>

                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{title}</h2>
                <p className="text-white/55 text-sm mb-3">{subtitle}</p>

                {/* E2E badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-white/50">End-to-end encrypted</span>
                </div>
            </div>

            {/* Bottom controls */}
            <div className="relative z-10 pb-16 px-10 w-full">
                <div className="flex items-center justify-center gap-16">
                    {/* Decline */}
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={rejectCall}
                            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                boxShadow: '0 8px 28px rgba(239,68,68,0.5)',
                            }}
                        >
                            <PhoneOff className="w-7 h-7 text-white" />
                        </button>
                        <span className="text-white/60 text-xs font-medium">
                            {callMode === 'group' ? 'Ignore' : 'Decline'}
                        </span>
                    </div>

                    {/* Accept */}
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={answerCall}
                            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
                            style={{
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                boxShadow: '0 8px 28px rgba(34,197,94,0.5)',
                                animation: 'callPulse 1.8s ease-in-out infinite',
                            }}
                        >
                            {isVideo ? <Video className="w-7 h-7 text-white" /> : <Phone className="w-7 h-7 text-white" />}
                        </button>
                        <span className="text-white/60 text-xs font-medium">
                            {callMode === 'group' ? 'Join' : 'Accept'}
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes callPulse {
                    0%, 100% { box-shadow: 0 8px 28px rgba(34,197,94,0.5); }
                    50% { box-shadow: 0 8px 40px rgba(34,197,94,0.75), 0 0 0 8px rgba(34,197,94,0.15); }
                }
            `}</style>
        </div>
    );
}
