// client/src/components/chat/MessageArea.jsx
// Main chat message area with header, messages, and input

import { useEffect, useRef, useCallback, useState } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Pin, Trash2, Search, Users } from 'lucide-react';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import useSocket from '../../hooks/useSocket';
import useWebRTC from '../../hooks/useWebRTC';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { formatLastSeen } from '../../utils/formatters';

export default function MessageArea({ onBack, onProfileClick }) {
    const { activeChat, messages, isLoadingMessages, hasMoreMessages, loadMoreMessages, typingUsers, onlineUsers, markAsSeen, togglePin } = useChatStore();
    const { user } = useAuthStore();
    const { emitMessageSeen } = useSocket();
    const { startCall } = useWebRTC();
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);
    const [searchMessages, setSearchMessages] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const otherUser = activeChat?.participants?.find((p) => p._id !== user._id);

    const chatInfo = activeChat?.isGroup ? {
        name: activeChat.groupName,
        avatar: activeChat.groupAvatar,
        isGroup: true,
        onlineStatus: `${activeChat.participants.length} members`
    } : {
        name: otherUser?.name,
        avatar: otherUser?.avatar,
        isGroup: false,
        onlineStatus: onlineUsers.has(otherUser?._id) ? 'online' : `last seen ${formatLastSeen(otherUser?.lastSeen)}`,
        _id: otherUser?._id
    };

    const isOnline = !chatInfo.isGroup && onlineUsers.has(otherUser?._id);
    const isTyping = typingUsers[activeChat?._id];
    const isPinned = activeChat?.pinnedBy?.includes(user._id);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]);

    // Mark messages as seen when chat becomes active
    useEffect(() => {
        if (activeChat) {
            markAsSeen(activeChat._id);
            if (otherUser) {
                emitMessageSeen(activeChat._id, otherUser._id);
            }
        }
    }, [activeChat?._id, messages.length]);

    // Infinite scroll handler
    const handleScroll = useCallback((e) => {
        if (e.target.scrollTop < 50 && hasMoreMessages && !isLoadingMessages) {
            loadMoreMessages();
        }
    }, [hasMoreMessages, isLoadingMessages]);

    // Group messages by date
    const groupedMessages = messages.reduce((groups, msg) => {
        const date = new Date(msg.createdAt).toDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(msg);
        return groups;
    }, {});

    // Filter by search
    const filteredGroups = searchMessages
        ? Object.fromEntries(
            Object.entries(groupedMessages).map(([date, msgs]) => [
                date,
                msgs.filter((m) => m.text?.toLowerCase().includes(searchMessages.toLowerCase())),
            ]).filter(([_, msgs]) => msgs.length > 0)
        )
        : groupedMessages;

    if (!chatInfo.name && !otherUser) return null;

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Chat Header */}
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 glass-panel border-b border-white/5">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden p-1 rounded-lg hover:bg-white/5">
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer" onClick={onProfileClick}>
                        {chatInfo.avatar ? (
                            <img src={chatInfo.avatar} alt={chatInfo.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                                style={{ background: chatInfo.isGroup ? 'var(--gradient-primary)' : 'var(--gradient-accent)' }}>
                                {chatInfo.isGroup ? <Users className="w-5 h-5" /> : chatInfo.name?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm">{chatInfo.name}</h3>
                        <p className="text-xs opacity-50">
                            {isTyping
                                ? 'typing...'
                                : chatInfo.onlineStatus}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                        <Search className="w-5 h-5 opacity-50" />
                    </button>
                    {!chatInfo.isGroup && (
                        <button
                            onClick={() => startCall(otherUser._id)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                            title="Video call"
                        >
                            <Video className="w-5 h-5 opacity-50" />
                        </button>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <MoreVertical className="w-5 h-5 opacity-50" />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 glass-card p-1 w-44 z-20 animate-slide-up">
                                <button
                                    onClick={() => { togglePin(activeChat._id); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <Pin className="w-4 h-4" />
                                    {isPinned ? 'Unpin Chat' : 'Pin Chat'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Messages Bar */}
            {showSearch && (
                <div className="px-4 py-2 border-b border-white/5 animate-slide-up">
                    <input
                        type="text"
                        value={searchMessages}
                        onChange={(e) => setSearchMessages(e.target.value)}
                        placeholder="Search in conversation..."
                        className="input-glass py-2 text-sm"
                        autoFocus
                    />
                </div>
            )}

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3"
            >
                {isLoadingMessages && messages.length === 0 && (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                    </div>
                )}

                {hasMoreMessages && (
                    <div className="flex justify-center py-2">
                        <button
                            onClick={loadMoreMessages}
                            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                        >
                            Load older messages
                        </button>
                    </div>
                )}

                {Object.entries(filteredGroups).map(([date, msgs]) => (
                    <div key={date}>
                        {/* Date divider */}
                        <div className="flex items-center justify-center my-4">
                            <span className="px-3 py-1 text-[11px] opacity-40 glass-card rounded-full">
                                {new Date(date).toDateString() === new Date().toDateString()
                                    ? 'Today'
                                    : new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString()
                                        ? 'Yesterday'
                                        : new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        {msgs.map((message, index) => (
                            <MessageBubble
                                key={message._id}
                                message={message}
                                isOwn={
                                    (message.senderId?._id || message.senderId) === user._id
                                }
                                otherUser={otherUser}
                                showAvatar={
                                    index === 0 ||
                                    (msgs[index - 1]?.senderId?._id || msgs[index - 1]?.senderId) !==
                                    (message.senderId?._id || message.senderId)
                                }
                            />
                        ))}
                    </div>
                ))}

                {isTyping && <TypingIndicator />}

                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput chatId={activeChat._id} recipientId={otherUser?._id} isGroup={chatInfo.isGroup} />
        </div>
    );
}
