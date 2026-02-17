// client/src/components/chat/ChatItem.jsx
// Individual chat item in the sidebar list

import { formatTime, formatMessagePreview } from '../../utils/formatters';
import { Pin, Image, Users } from 'lucide-react';

export default function ChatItem({ chat, displayUser, isActive, isOnline, isTyping, unreadCount, isPinned, onClick }) {
    const lastMsg = chat.lastMessage;

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group
        ${isActive
                    ? 'bg-primary-500/15 border border-primary-500/20'
                    : 'hover:bg-white/5 border border-transparent'
                }
      `}
        >
            {/* Avatar with online status */}
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                    {displayUser.avatar ? (
                        <img src={displayUser.avatar} alt={displayUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold"
                            style={{ background: displayUser.isGroup ? 'var(--gradient-primary)' : 'var(--gradient-accent)' }}>
                            {displayUser.isGroup ? <Users className="w-6 h-6" /> : displayUser.name[0].toUpperCase()}
                        </div>
                    )}
                </div>
                {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-surface-900 dark:border-surface-900" />
                )}
            </div>

            {/* Chat info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold truncate ${unreadCount > 0 ? 'opacity-100' : 'opacity-80'}`}>
                        {displayUser.name}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isPinned && <Pin className="w-3 h-3 text-primary-400" />}
                        {lastMsg && (
                            <span className="text-[11px] opacity-40">
                                {formatTime(lastMsg.createdAt || chat.updatedAt)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${isTyping ? 'text-primary-400' : 'opacity-45'}`}>
                        {isTyping ? (
                            <span className="flex items-center gap-1">
                                typing
                                <span className="flex gap-0.5">
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                </span>
                            </span>
                        ) : lastMsg ? (
                            lastMsg.imageUrl && !lastMsg.text ? (
                                <span className="flex items-center gap-1">
                                    <Image className="w-3 h-3" /> Photo
                                </span>
                            ) : lastMsg.isDeleted ? (
                                <span className="italic">Message deleted</span>
                            ) : (
                                formatMessagePreview(lastMsg.text)
                            )
                        ) : (
                            'Start chatting...'
                        )}
                    </p>

                    {unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--gradient-primary)' }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
