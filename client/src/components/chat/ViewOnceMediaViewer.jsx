import { useEffect, useMemo, useState } from 'react';
import { X, TimerReset } from 'lucide-react';

export default function ViewOnceMediaViewer({ mediaUrl, type = 'image', durationSeconds = 10, onClose }) {
    const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

    useEffect(() => {
        const closeTimer = window.setTimeout(() => {
            onClose?.();
        }, durationSeconds * 1000);

        const countdown = window.setInterval(() => {
            setSecondsLeft((value) => Math.max(value - 1, 0));
        }, 1000);

        return () => {
            window.clearTimeout(closeTimer);
            window.clearInterval(countdown);
        };
    }, [durationSeconds, onClose]);

    const mediaNode = useMemo(() => {
        if (type === 'video') {
            return (
                <video
                    src={mediaUrl}
                    className="max-w-full max-h-[86vh] object-contain rounded-[28px]"
                    autoPlay
                    playsInline
                    controls={false}
                />
            );
        }

        return (
            <img
                src={mediaUrl}
                alt="View once media"
                className="max-w-full max-h-[86vh] object-contain rounded-[28px]"
            />
        );
    }, [mediaUrl, type]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={onClose}>
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/85 border border-white/10">
                <TimerReset className="w-4 h-4" />
                Closing in {secondsLeft}s
            </div>

            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/10"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="relative" onClick={(event) => event.stopPropagation()}>
                {mediaNode}
            </div>
        </div>
    );
}
