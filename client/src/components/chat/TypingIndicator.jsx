// client/src/components/chat/TypingIndicator.jsx
// Animated typing indicator dots

export default function TypingIndicator() {
    return (
        <div className="flex items-start mb-2 animate-fade-in">
            <div className="bubble-received px-4 py-3 flex items-center gap-1.5">
                <span className="typing-dot w-2 h-2 rounded-full bg-primary-400 inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary-400 inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-primary-400 inline-block" />
            </div>
        </div>
    );
}
