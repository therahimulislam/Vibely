// client/src/components/chat/MessageArea.jsx
// Main chat message area with header, messages, and input

import { useEffect, useRef, useCallback, useState } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Pin, Trash2, Search, Users, UserPlus, Check, X as CloseIcon, UserRoundMinus } from 'lucide-react';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import useStatusStore from '../../store/useStatusStore';
import useSocket from '../../hooks/useSocket';
import useWebRTC from '../../hooks/useWebRTC';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { formatLastSeen } from '../../utils/formatters';

export default function MessageArea({ onBack, onProfileClick }) {
    const { activeChat, messages, isLoadingMessages, hasMoreMessages, loadMoreMessages, typingUsers, onlineUsers, markAsSeen, togglePin, deleteChat, addToGroup, respondToRequest } = useChatStore();
    const { user, removeContact } = useAuthStore();
    const { fetchStatuses } = useStatusStore();
    const { emitMessageSeen } = useSocket();
    const { startCall } = useWebRTC();
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);
    const [searchMessages, setSearchMessages] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Defensive check
    if (!user || !activeChat) return null;

    // Filter out null participants (e.g. deleted users)
    const participants = (activeChat?.participants || []).filter(p => p);
    const otherUser = participants.find((p) => p._id !== user._id);

    const chatInfo = activeChat?.isGroup ? {
        name: activeChat.groupName || 'Group Chat',
        avatar: activeChat.groupAvatar,
        isGroup: true,
        onlineStatus: `${participants.length} members`
    } : {
        name: otherUser?.name,
        avatar: otherUser?.avatar,
        isGroup: false,
        onlineStatus: ((onlineUsers instanceof Set && onlineUsers.has(otherUser?._id)) || otherUser?.isOnline) ? 'online' : `last seen ${formatLastSeen(otherUser?.lastSeen)}`,
        _id: otherUser?._id
    };

    const isOnline = !chatInfo.isGroup && ((onlineUsers instanceof Set ? onlineUsers.has(otherUser?._id) : false) || !!otherUser?.isOnline);
    const isTyping = typingUsers?.[activeChat?._id];
    const isPinned = activeChat?.pinnedBy?.includes(user._id);
    const isPendingRequest = !activeChat?.isGroup && activeChat?.requestStatus === 'pending';
    const isRequester = activeChat?.requestedBy?._id === user._id || activeChat?.requestedBy === user._id;

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

    // Use fallback if name is missing but it's a valid chat (e.g. group with no name)
    if (!chatInfo.name && !otherUser && !activeChat.isGroup) return null;

    return (
        <div className="flex-1 flex flex-col h-full relative">
            {/* Chat Header */}
            <div className="px-3 sm:px-4 py-3 flex items-center justify-between flex-shrink-0 glass-panel border-b border-white/5 relative z-10 bg-background/50 backdrop-blur-md min-h-[60px]">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <button onClick={onBack} className="md:hidden p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer flex-shrink-0" onClick={onProfileClick}>
                        {chatInfo.avatar ? (
                            <img src={chatInfo.avatar} alt={chatInfo.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                                style={{ background: chatInfo.isGroup ? 'var(--gradient-primary)' : 'var(--gradient-accent)' }}>
                                {chatInfo.isGroup ? <Users className="w-5 h-5" /> : chatInfo.name?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">{chatInfo.name || 'Chat'}</h3>
                        <p className="text-xs opacity-50 truncate">
                            {isTyping
                                ? 'typing...'
                                : chatInfo.onlineStatus}
                        </p>
                        {!chatInfo.isGroup && otherUser?.username && (
                            <p className="text-[11px] opacity-35 truncate">@{otherUser.username}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className="hidden md:block p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                        <Search className="w-5 h-5 opacity-50" />
                    </button>
                    <button
                        onClick={() => {
                            if (chatInfo.isGroup) {
                                startCall({
                                    chatId: activeChat._id,
                                    chatName: activeChat.groupName || 'Group Chat',
                                    chatAvatar: activeChat.groupAvatar,
                                }, 'audio');
                                return;
                            }

                            startCall(otherUser._id, 'audio', {
                                name: otherUser?.name,
                                avatar: otherUser?.avatar,
                                username: otherUser?.username,
                            });
                        }}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        title={chatInfo.isGroup ? 'Start group audio call' : 'Audio call'}
                    >
                        <Phone className="w-5 h-5 opacity-50" />
                    </button>
                    <button
                        onClick={() => {
                            if (chatInfo.isGroup) {
                                startCall({
                                    chatId: activeChat._id,
                                    chatName: activeChat.groupName || 'Group Chat',
                                    chatAvatar: activeChat.groupAvatar,
                                }, 'video');
                                return;
                            }

                            startCall(otherUser._id, 'video', {
                                name: otherUser?.name,
                                avatar: otherUser?.avatar,
                                username: otherUser?.username,
                            });
                        }}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        title={chatInfo.isGroup ? 'Start group video call' : 'Video call'}
                    >
                        <Video className="w-5 h-5 opacity-50" />
                    </button>
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
                                {chatInfo.isGroup && (
                                    <button
                                        onClick={() => {
                                            const username = window.prompt('Enter username to add:');
                                            if (username) addToGroup(activeChat._id, null, username);
                                            setShowMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Add Members
                                    </button>
                                )}
                                {!chatInfo.isGroup && (
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('Remove this contact?')) {
                                                await removeContact(otherUser._id);
                                                await fetchStatuses();
                                            }
                                            setShowMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-500/10 text-red-300 transition-colors"
                                    >
                                        <UserRoundMinus className="w-4 h-4" />
                                        Remove Contact
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this chat?')) {
                                            deleteChat(activeChat._id);
                                            onBack(); // Go back to list on mobile/desktop
                                        }
                                        setShowMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Chat
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
                {isPendingRequest && !isRequester && (
                    <div className="mb-4 glass-card p-4 rounded-2xl border border-primary-500/20">
                        <p className="text-sm font-medium mb-2">{otherUser?.name} wants to chat with you</p>
                        <p className="text-xs opacity-55 mb-3">Accept to reply, or reject to remove this request.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    await respondToRequest(activeChat._id, 'accept');
                                }}
                                className="btn-primary px-4 py-2 text-sm"
                            >
                                <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Accept</span>
                            </button>
                            <button
                                onClick={async () => {
                                    await respondToRequest(activeChat._id, 'reject');
                                    onBack?.();
                                }}
                                className="btn-glass px-4 py-2 text-sm"
                            >
                                <span className="flex items-center gap-2"><CloseIcon className="w-4 h-4" /> Reject</span>
                            </button>
                        </div>
                    </div>
                )}

                {isPendingRequest && isRequester && (
                    <div className="mb-4 glass-card p-4 rounded-2xl border border-white/10">
                        <p className="text-sm font-medium">Chat request sent</p>
                        <p className="text-xs opacity-55 mt-1">They need to accept before replying.</p>
                    </div>
                )}

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
            <MessageInput
                chatId={activeChat._id}
                recipientId={otherUser?._id}
                isGroup={chatInfo.isGroup}
                disabled={isPendingRequest && !isRequester}
            />
        </div>
    );
}
