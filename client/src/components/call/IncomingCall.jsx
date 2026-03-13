// client/src/components/call/IncomingCall.jsx
// Incoming direct and group call notification overlay

import { Phone, PhoneOff, Users } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in">
            <div className="glass-card p-8 max-w-sm w-full mx-4 text-center animate-bounce-in">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden ring-4 ring-primary-500/30 animate-pulse-soft">
                    {avatar ? (
                        <img src={avatar} alt={title} className="w-full h-full object-cover" />
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                            style={{ background: 'var(--gradient-primary)' }}
                        >
                            {callMode === 'group' ? <Users className="w-10 h-10" /> : (callerInfo?.name?.[0]?.toUpperCase() || '?')}
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold mb-1">{title}</h3>
                <p className="text-sm opacity-50 mb-2">{subtitle}</p>
                {callMode === 'group' && (
                    <p className="text-xs opacity-35 mb-6">Join to connect with everyone in this chat</p>
                )}

                <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs opacity-50">End-to-end encrypted</span>
                </div>

                <div className="flex items-center justify-center gap-6">
                    <button
                        onClick={rejectCall}
                        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
                    >
                        <PhoneOff className="w-7 h-7" />
                    </button>

                    <button
                        onClick={answerCall}
                        className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-all shadow-lg shadow-green-500/30 animate-pulse-soft"
                    >
                        <Phone className="w-7 h-7" />
                    </button>
                </div>

                <div className="flex justify-between mt-6 px-4">
                    <span className="text-xs opacity-40">{callMode === 'group' ? 'Ignore' : 'Decline'}</span>
                    <span className="text-xs opacity-40">{callMode === 'group' ? 'Join' : 'Accept'}</span>
                </div>
            </div>
        </div>
    );
}
