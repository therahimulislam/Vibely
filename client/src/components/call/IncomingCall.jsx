// client/src/components/call/IncomingCall.jsx
// Incoming call notification overlay

import { Phone, PhoneOff } from 'lucide-react';
import useCallStore from '../../store/useCallStore';
import useWebRTC from '../../hooks/useWebRTC';

export default function IncomingCall() {
    const { isReceivingCall, callerInfo } = useCallStore();
    const { answerCall, rejectCall } = useWebRTC();

    if (!isReceivingCall) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in">
            <div className="glass-card p-8 max-w-sm w-full mx-4 text-center animate-bounce-in">
                {/* Caller Avatar */}
                <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden ring-4 ring-primary-500/30 animate-pulse-soft">
                    {callerInfo?.avatar ? (
                        <img src={callerInfo.avatar} alt={callerInfo.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                            style={{ background: 'var(--gradient-primary)' }}>
                            {callerInfo?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-bold mb-1">{callerInfo?.name || 'Unknown'}</h3>
                <p className="text-sm opacity-50 mb-8">Incoming video call...</p>

                {/* E2E badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs opacity-50">End-to-end encrypted</span>
                </div>

                {/* Action buttons */}
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
                    <span className="text-xs opacity-40">Decline</span>
                    <span className="text-xs opacity-40">Accept</span>
                </div>
            </div>
        </div>
    );
}
