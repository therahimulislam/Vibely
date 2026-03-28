// client/src/components/call/IncomingCall.jsx
// Incoming direct and group call notification overlay

import { Phone, PhoneOff, Users } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';
import AvatarFallback from '../ui/AvatarFallback';

export default function IncomingCall() {
    const { isReceivingCall, callerInfo, callType, callMode, chatName, chatAvatar } = useCallStore();
    const { answerCall, rejectCall } = useWebRTC();

    if (!isReceivingCall) return null;

    const title = callMode === 'group' ? (chatName || 'Group call') : (callerInfo?.name || 'Unknown');
    const subtitle = callMode === 'group'
        ? `${callerInfo?.name || 'Someone'} started a ${callType === 'audio' ? 'group audio' : 'group video'} call`
        : `Incoming ${callType === 'audio' ? 'audio' : 'video'} call...`;
    const avatar = callMode === 'group' ? chatAvatar : callerInfo?.avatar;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-2xl animate-fade-in">
            <div className="glass-card p-8 max-w-sm w-full mx-4 text-center animate-bounce-in rounded-[32px] shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
                <div className="badge-pill mx-auto mb-4 w-fit !bg-white/10 !text-white/75">Incoming call</div>

                <div className="w-28 h-28 mx-auto mb-6 rounded-full overflow-hidden ring-4 ring-primary-500/30 animate-pulse-soft">
                    {avatar ? (
                        <img src={avatar} alt={title} className="w-full h-full object-cover" />
                    ) : (
                        <AvatarFallback
                            name={callerInfo?.name}
                            className="text-3xl"
                            variant={callMode === 'group' ? 'group' : 'person'}
                            icon={callMode === 'group' ? <Users className="w-10 h-10" /> : null}
                        />
                    )}
                </div>

                <h3 className="text-2xl font-semibold mb-1 text-white">{title}</h3>
                <p className="text-sm opacity-60 mb-2 leading-6">{subtitle}</p>
                {callMode === 'group' && (
                    <p className="text-xs opacity-40 mb-6">Join to connect with everyone in this chat</p>
                )}

                <div className="flex items-center justify-center gap-2 mb-8">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs opacity-55">End-to-end encrypted</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={rejectCall}
                        className="rounded-[24px] bg-red-500/90 hover:bg-red-500 text-white px-4 py-4 flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-500/25"
                    >
                        <PhoneOff className="w-5 h-5" />
                        <span className="text-sm font-medium">{callMode === 'group' ? 'Ignore' : 'Decline'}</span>
                    </button>

                    <button
                        onClick={answerCall}
                        className="rounded-[24px] bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-4 flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-500/25 animate-pulse-soft"
                    >
                        <Phone className="w-5 h-5" />
                        <span className="text-sm font-medium">{callMode === 'group' ? 'Join' : 'Accept'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
