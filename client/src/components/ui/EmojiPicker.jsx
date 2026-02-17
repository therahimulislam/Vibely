// client/src/components/ui/EmojiPicker.jsx
// Simple emoji picker dropdown

import { EMOJI_LIST } from '../../utils/constants';

const FULL_EMOJI_LIST = [
    '😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😋',
    '🤔', '😮', '😢', '😡', '🔥', '👍', '👎', '🎉',
    '💯', '🙏', '💪', '👋', '🤝', '✨', '💫', '⭐',
    '🌟', '💝', '💖', '💕', '🥺', '😎', '🤗', '😇',
];

export default function EmojiPicker({ onSelect, onClose }) {
    return (
        <div className="glass-card p-3 rounded-xl w-64 animate-slide-up">
            <div className="grid grid-cols-8 gap-1">
                {FULL_EMOJI_LIST.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => { onSelect(emoji); onClose?.(); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-transform hover:scale-125 text-lg text-center"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
