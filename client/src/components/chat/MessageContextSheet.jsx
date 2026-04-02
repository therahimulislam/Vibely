// client/src/components/chat/MessageContextSheet.jsx
// Mobile long-press bottom sheet + desktop hover panel for message actions

import { useEffect } from 'react';
import {
    Bookmark, Check, Clock3, Edit3, EyeOff, Forward, Pin,
    Reply, SmilePlus, Star, Trash2, X,
} from 'lucide-react';
import { EMOJI_LIST } from '../../utils/constants';

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export default function MessageContextSheet({
    message,
    isOwn,
    isStarred,
    isPinned,
    onClose,
    onReact,
    onReply,
    onStar,
    onForward,
    onPin,
    onBookmark,
    onRemind,
    onEdit,
    onDeleteMe,
    onDeleteAll,
}) {
    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const action = (fn) => () => { fn(); onClose(); };

    const menuItems = [
        { icon: <Reply className="w-5 h-5" />, label: 'Reply', fn: action(onReply) },
        { icon: <Star className={`w-5 h-5 ${isStarred ? 'fill-amber-300 text-amber-300' : ''}`} />, label: isStarred ? 'Unstar' : 'Star', fn: action(onStar) },
        ...(!message?.viewOnce?.enabled ? [
            { icon: <Forward className="w-5 h-5" />, label: 'Forward', fn: action(onForward) },
        ] : []),
        { icon: <Pin className={`w-5 h-5 ${isPinned ? 'text-primary-300' : ''}`} />, label: isPinned ? 'Unpin' : 'Pin', fn: action(onPin) },
        { icon: <Bookmark className="w-5 h-5" />, label: 'Bookmark', fn: action(onBookmark) },
        { icon: <Clock3 className="w-5 h-5" />, label: 'Remind me', fn: action(onRemind) },
        ...(isOwn && message?.type === 'text' ? [
            { icon: <Edit3 className="w-5 h-5" />, label: 'Edit', fn: onEdit /* keep sheet open for edit */ },
        ] : []),
        ...(isOwn ? [
            { icon: <Trash2 className="w-5 h-5 text-red-300" />, label: 'Delete for me', fn: action(onDeleteMe), danger: true },
            { icon: <Trash2 className="w-5 h-5 text-red-400" />, label: 'Delete for all', fn: action(onDeleteAll), danger: true },
        ] : [
            { icon: <Trash2 className="w-5 h-5 text-red-300" />, label: 'Delete for me', fn: action(onDeleteMe), danger: true },
        ]),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

            {/* Sheet */}
            <div
                className="relative w-full sm:max-w-sm mx-auto glass-panel border border-white/10 rounded-t-[32px] sm:rounded-[28px] pb-safe animate-sheet-up shadow-[0_-8px_48px_rgba(0,0,0,0.5)]"
                style={{ background: 'rgba(14,17,32,0.96)', maxHeight: '88dvh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Quick reactions */}
                <div className="px-4 pt-3 pb-3 border-b border-white/8">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            {QUICK_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => { onReact(emoji); onClose(); }}
                                    className="w-11 h-11 flex items-center justify-center text-2xl rounded-2xl hover:bg-white/10 active:scale-90 transition-all"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/8 ml-auto"
                        >
                            <X className="w-4 h-4 opacity-50" />
                        </button>
                    </div>
                </div>

                {/* Message preview */}
                {message?.text && (
                    <div className="mx-4 mt-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                        <p className="text-sm opacity-60 line-clamp-2">{message.text}</p>
                    </div>
                )}

                {/* Action items */}
                <div className="p-2 mt-1">
                    {menuItems.map((item, i) => (
                        <button
                            key={i}
                            onClick={item.fn}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-colors ${item.danger ? 'hover:bg-red-500/10 text-red-300' : 'hover:bg-white/6'}`}
                        >
                            <span className={item.danger ? 'text-red-300' : 'opacity-60'}>{item.icon}</span>
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>

                {/* Bottom safe area spacer */}
                <div className="h-4" />
            </div>
        </div>
    );
}
