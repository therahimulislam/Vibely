// client/src/components/call/CallControls.jsx
// Call control buttons (reusable)

import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor } from 'lucide-react';

export default function CallControls({ isAudioMuted, isVideoOff, onToggleAudio, onToggleVideo, onEndCall }) {
    return (
        <div className="flex items-center gap-4">
            <button
                onClick={onToggleAudio}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                title={isAudioMuted ? 'Unmute' : 'Mute'}
            >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
                onClick={onToggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
                onClick={onEndCall}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30 transition-all"
                title="End call"
            >
                <PhoneOff className="w-6 h-6" />
            </button>
        </div>
    );
}
