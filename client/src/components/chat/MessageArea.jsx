// client/src/components/chat/MessageArea.jsx
// Main chat message area with header, messages, and input

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Pin, Trash2, Search, Users, UserPlus, Check, X as CloseIcon, UserRoundMinus, Archive, ArchiveRestore, Bookmark, Image as ImageIcon, FileText, Mic, Link2, Filter, Clock3, Shield } from 'lucide-react';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import useStatusStore from '../../store/useStatusStore';
import useSocket from '../../hooks/useSocket';
import useWebRTC from '../../hooks/useWebRTC';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import { formatLastSeen } from '../../utils/formatters';
import AvatarFallback from '../ui/AvatarFallback';
import { getDisplayName } from '../../utils/userDisplay';

export default function MessageArea({ onBack, onProfileClick }) {
    const {
        activeChat,
        messages,
        isLoadingMessages,
        hasMoreMessages,
        loadMoreMessages,
        typingUsers,
        onlineUsers,
        markAsSeen,
        togglePin,
        toggleArchiveChat,
        deleteChat,
        respondToRequest,
        messageSearchResults,
        isSearchingChatMessages,
        searchChatMessages,
        clearChatSearch,
        insertMessageIfMissing,
        pinnedMessages,
    } = useChatStore();
    const { user, removeContact } = useAuthStore();
    const { fetchStatuses } = useStatusStore();
    const { emitMessageSeen } = useSocket();
    const { startCall } = useWebRTC();
    const messagesContainerRef = useRef(null);
    const messageRefs = useRef({});
    const messageInputWrapperRef = useRef(null);
    const previousChatIdRef = useRef(null);
    const previousMessagesLengthRef = useRef(0);
    const previousScrollHeightRef = useRef(0);
    const loadingOlderRef = useRef(false);
    const shouldStickToBottomRef = useRef(true);
    const [showMenu, setShowMenu] = useState(false);
    const [searchMessages, setSearchMessages] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchFilter, setSearchFilter] = useState('all');
    const [searchSenderId, setSearchSenderId] = useState('');
    const [searchDateFrom, setSearchDateFrom] = useState('');
    const [searchDateTo, setSearchDateTo] = useState('');
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [showScrollFab, setShowScrollFab] = useState(false);

    // Defensive check
    if (!user || !activeChat) return null;

    // Filter out null participants (e.g. deleted users)
    const participants = (activeChat?.participants || []).filter(p => p);
    const otherUser = participants.find((p) => p._id !== user._id);
    const otherUserDisplayName = getDisplayName(otherUser, user);
    const isSavedMessagesChat = !!activeChat?.isSavedMessages;

    const chatInfo = isSavedMessagesChat ? {
        name: 'Saved Messages',
        avatar: '',
        isGroup: false,
        isSavedMessages: true,
        onlineStatus: 'Personal cloud',
        _id: user._id,
    } : activeChat?.isGroup ? {
        name: activeChat.groupName || 'Group Chat',
        avatar: activeChat.groupAvatar,
        isGroup: true,
        isSavedMessages: false,
        onlineStatus: `${participants.length} members`
    } : {
        name: otherUserDisplayName,
        avatar: otherUser?.avatar,
        isGroup: false,
        isSavedMessages: false,
        onlineStatus: ((onlineUsers instanceof Set && onlineUsers.has(otherUser?._id)) || otherUser?.isOnline) ? 'online' : `last seen ${formatLastSeen(otherUser?.lastSeen)}`,
        _id: otherUser?._id
    };

    const isOnline = !chatInfo.isGroup && !isSavedMessagesChat && ((onlineUsers instanceof Set ? onlineUsers.has(otherUser?._id) : false) || !!otherUser?.isOnline);
    const isTyping = typingUsers?.[activeChat?._id];
    const isPinned = activeChat?.pinnedBy?.includes(user._id);
    const isArchived = activeChat?.archivedBy?.includes(user._id);
    const isPendingRequest = !activeChat?.isGroup && !isSavedMessagesChat && activeChat?.requestStatus === 'pending';
    const isRequester = activeChat?.requestedBy?._id === user._id || activeChat?.requestedBy === user._id;
    const groupOwnerId = activeChat?.groupOwner?._id || activeChat?.groupOwner || activeChat?.groupAdmin?._id || activeChat?.groupAdmin || null;
    const groupAdminIds = Array.from(new Set([
        ...((activeChat?.groupAdmins || []).map((entry) => `${entry?._id || entry || ''}`).filter(Boolean)),
        ...(groupOwnerId ? [`${groupOwnerId}`] : []),
    ]));
    const isCurrentUserGroupAdmin = !!activeChat?.isGroup && groupAdminIds.some((adminId) => `${adminId}` === `${user._id}`);
    const groupSettings = activeChat?.groupSettings || {};
    const disappearingMessages = activeChat?.disappearingMessages || {};
    const formatDisappearingLabel = (hours) => {
        if (!hours) return 'Disappearing off';
        if (hours === 24) return '24h disappear';
        if (hours === 168) return '7d disappear';
        if (hours === 2160) return '90d disappear';
        return `${hours}h disappear`;
    };
    const formatSlowModeLabel = (seconds) => {
        if (!seconds) return '';
        if (seconds < 60) return `${seconds}s slow mode`;
        if (seconds % 3600 === 0) return `${seconds / 3600}h slow mode`;
        if (seconds % 60 === 0) return `${seconds / 60}m slow mode`;
        return `${seconds}s slow mode`;
    };
    const openChatDetails = () => onProfileClick?.(
        isSavedMessagesChat
            ? { mode: 'self' }
            : chatInfo.isGroup
            ? { mode: 'group', chat: activeChat }
            : { mode: 'user', user: otherUser, chat: activeChat }
    );
    const groupPolicyBadges = [];
    if (chatInfo.isGroup && disappearingMessages?.enabled) {
        groupPolicyBadges.push({
            key: 'disappearing',
            icon: Clock3,
            label: formatDisappearingLabel(disappearingMessages.durationHours),
            tone: 'primary',
        });
    }
    if (chatInfo.isGroup && groupSettings?.slowModeSeconds > 0) {
        groupPolicyBadges.push({
            key: 'slow-mode',
            icon: Clock3,
            label: formatSlowModeLabel(groupSettings.slowModeSeconds),
            tone: 'neutral',
        });
    }
    if (chatInfo.isGroup && groupSettings?.adminOnlyMessages) {
        groupPolicyBadges.push({
            key: 'admin-posting',
            icon: Shield,
            label: 'Admins post only',
            tone: 'warning',
        });
    }
    if (chatInfo.isGroup && groupSettings?.joinApprovalEnabled) {
        groupPolicyBadges.push({
            key: 'join-approval',
            icon: Users,
            label: 'Join approval on',
            tone: 'neutral',
        });
    }

    const searchFilterOptions = [
        { value: 'all', label: 'All', icon: Search },
        { value: 'media', label: 'Media', icon: ImageIcon },
        { value: 'documents', label: 'Docs', icon: FileText },
        { value: 'audio', label: 'Voice', icon: Mic },
        { value: 'links', label: 'Links', icon: Link2 },
        { value: 'polls', label: 'Polls', icon: Filter },
    ];

    const getSearchResultPreview = (message) => {
        if (!message) return 'Message';
        if (message.isDeleted) return 'Deleted message';
        if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
        if (message.type === 'poll') return `Poll: ${message.poll?.question || 'Untitled poll'}`;
        if (message.type === 'image') return message.text || 'Photo';
        if (message.type === 'video') return message.text || 'Video';
        if (message.type === 'audio') return 'Voice message';
        if (message.type === 'document') return message.fileName || 'Document';
        return message.text || 'Message';
    };

    const getPinnedPreview = (message) => {
        if (!message) return 'Pinned message';
        if (message.isDeleted) return 'Deleted message';
        if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
        if (message.type === 'poll') return message.poll?.question || 'Pinned poll';
        if (message.type === 'image') return message.text || 'Pinned photo';
        if (message.type === 'video') return message.text || 'Pinned video';
        if (message.type === 'audio') return 'Pinned voice message';
        if (message.type === 'document') return message.fileName || 'Pinned document';
        return message.text || 'Pinned message';
    };

    const handleOpenSearchResult = (message) => {
        insertMessageIfMissing(message);
        setShowSearch(false);
        setHighlightedMessageId(message._id);

        window.setTimeout(() => {
            messageRefs.current[message._id]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }, 80);

        window.setTimeout(() => {
            setHighlightedMessageId((current) => current === message._id ? null : current);
        }, 2200);
    };

    const scrollToBottom = useCallback((behavior = 'smooth') => {
        const container = messagesContainerRef.current;
        if (!container) return;

        container.scrollTo({
            top: container.scrollHeight,
            behavior,
        });
    }, []);

    const requestOlderMessages = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container || !hasMoreMessages || isLoadingMessages || loadingOlderRef.current) return;

        previousScrollHeightRef.current = container.scrollHeight;
        loadingOlderRef.current = true;
        loadMoreMessages();
    }, [hasMoreMessages, isLoadingMessages, loadMoreMessages]);

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage?._id || null;
    const latestMessageSenderId = latestMessage?.senderId?._id || latestMessage?.senderId || null;

    // Keep the conversation stable when older messages load, but still follow live sending near the bottom.
    useLayoutEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || !activeChat?._id) return;

        const currentChatId = activeChat._id;
        const previousChatId = previousChatIdRef.current;
        const chatChanged = previousChatId !== currentChatId;

        if (chatChanged) {
            previousChatIdRef.current = currentChatId;
            previousMessagesLengthRef.current = messages.length;
            scrollToBottom('auto');
            return;
        }

        if (loadingOlderRef.current) {
            const heightDelta = container.scrollHeight - previousScrollHeightRef.current;
            container.scrollTop += heightDelta;
            loadingOlderRef.current = false;
            previousScrollHeightRef.current = 0;
            previousMessagesLengthRef.current = messages.length;
            return;
        }

        if (messages.length !== previousMessagesLengthRef.current) {
            const sentByCurrentUser = `${latestMessageSenderId || ''}` === `${user._id}`;
            if (shouldStickToBottomRef.current || sentByCurrentUser) {
                scrollToBottom('smooth');
            }
        }

        previousMessagesLengthRef.current = messages.length;
    }, [activeChat?._id, messages.length, latestMessageId, latestMessageSenderId, scrollToBottom, user._id]);

    useEffect(() => {
        shouldStickToBottomRef.current = true;
        loadingOlderRef.current = false;
        previousScrollHeightRef.current = 0;
        previousMessagesLengthRef.current = 0;
    }, [activeChat?._id]);

    useEffect(() => {
        if (!isLoadingMessages && loadingOlderRef.current) {
            loadingOlderRef.current = false;
            previousScrollHeightRef.current = 0;
        }
    }, [isLoadingMessages, messages.length]);

    // When the input area grows (multi-line, reply previews, etc.), keep the
    // messages list stuck to the bottom so the latest message stays visible.
    useEffect(() => {
        const wrapper = messageInputWrapperRef.current;
        if (!wrapper) return undefined;

        const observer = new ResizeObserver(() => {
            if (shouldStickToBottomRef.current) {
                scrollToBottom('auto');
            }
        });

        observer.observe(wrapper);
        return () => observer.disconnect();
    }, [scrollToBottom]);

    // Mark messages as seen when chat becomes active
    useEffect(() => {
        if (activeChat) {
            markAsSeen(activeChat._id);
            if (otherUser) {
                emitMessageSeen(activeChat._id, otherUser._id);
            }
        }
    }, [activeChat?._id, messages.length]);

    useEffect(() => {
        setSearchMessages('');
        setSearchFilter('all');
        setSearchSenderId('');
        setSearchDateFrom('');
        setSearchDateTo('');
        clearChatSearch();
        setShowSearch(false);
    }, [activeChat?._id]);

    useEffect(() => {
        if (!showSearch || !activeChat?._id) return undefined;

        const hasCriteria = searchMessages.trim() || searchFilter !== 'all' || searchDateFrom || searchDateTo || searchSenderId;
        if (!hasCriteria) {
            clearChatSearch();
            return undefined;
        }

        const timer = window.setTimeout(() => {
            searchChatMessages(activeChat._id, {
                query: searchMessages.trim(),
                filter: searchFilter,
                senderId: searchSenderId,
                dateFrom: searchDateFrom,
                dateTo: searchDateTo,
            }).catch(() => { });
        }, 220);

        return () => window.clearTimeout(timer);
    }, [showSearch, activeChat?._id, searchMessages, searchFilter, searchSenderId, searchDateFrom, searchDateTo]);

    // Infinite scroll handler
    const handleScroll = useCallback((e) => {
        const container = e.currentTarget;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        shouldStickToBottomRef.current = distanceFromBottom < 120;
        setShowScrollFab(distanceFromBottom > 300);

        if (container.scrollTop < 50) {
            requestOlderMessages();
        }
    }, [requestOlderMessages]);

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
    if (!chatInfo.name && !otherUser && !activeChat.isGroup && !isSavedMessagesChat) return null;

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full relative surface-elevated overflow-hidden">
            {/* Chat Header */}
            <div className="px-3.5 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between flex-shrink-0 glass-panel border-b border-white/5 relative z-10 min-h-[68px] sm:min-h-[72px]">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <button onClick={onBack} className="md:hidden icon-button !w-10 !h-10 flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={openChatDetails}
                        className="min-w-0 flex-1 flex items-center gap-3 rounded-2xl px-1.5 py-1.5 -ml-1.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/40"
                    >
                        <div className={`w-11 h-11 rounded-full overflow-hidden cursor-pointer flex-shrink-0 ${
                            isOnline ? 'ring-[2.5px] ring-emerald-400/70 animate-pulse-online' : 'ring-1 ring-white/10'
                        }`}>
                            {chatInfo.avatar ? (
                                <img src={chatInfo.avatar} alt={chatInfo.name} className="w-full h-full object-cover" />
                            ) : (
                                <AvatarFallback
                                    name={chatInfo.name}
                                    className="text-sm"
                                    variant={chatInfo.isGroup ? 'group' : chatInfo.isSavedMessages ? 'saved' : 'person'}
                                    icon={chatInfo.isSavedMessages ? <Bookmark className="w-5 h-5" /> : chatInfo.isGroup ? <Users className="w-5 h-5" /> : null}
                                />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-semibold text-sm truncate">{chatInfo.name || 'Chat'}</h3>
                                {isOnline && <span className="badge-pill text-emerald-300 hidden sm:inline-flex">Online</span>}
                            </div>
                            <p className="text-xs opacity-50 truncate mt-0.5">
                                {isTyping
                                    ? 'typing...'
                                    : chatInfo.onlineStatus}
                            </p>
                            {!chatInfo.isGroup && !chatInfo.isSavedMessages && otherUser?.username && (
                                <p className="text-[11px] opacity-35 truncate">@{otherUser.username}</p>
                            )}
                        </div>
                    </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className="hidden md:inline-flex icon-button"
                    >
                        <Search className="w-4 h-4 opacity-65" />
                    </button>
                    {!isSavedMessagesChat && (
                        <>
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
                                className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                                title={chatInfo.isGroup ? 'Start group audio call' : 'Audio call'}
                            >
                                <Phone className="w-4 h-4 opacity-65" />
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
                                className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                                title={chatInfo.isGroup ? 'Start group video call' : 'Video call'}
                            >
                                <Video className="w-4 h-4 opacity-65" />
                            </button>
                        </>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                        >
                            <MoreVertical className="w-4 h-4 opacity-65" />
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
                                <button
                                    onClick={async () => {
                                        await toggleArchiveChat(activeChat._id);
                                        setShowMenu(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                    {isArchived ? 'Move to Inbox' : 'Archive Chat'}
                                </button>
                                {chatInfo.isGroup && isCurrentUserGroupAdmin && (
                                    <button
                                        onClick={() => {
                                            openChatDetails();
                                            setShowMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Add Members
                                    </button>
                                )}
                                {!chatInfo.isGroup && !isSavedMessagesChat && (
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

            {groupPolicyBadges.length > 0 && (
                <div className="px-3.5 sm:px-5 pt-3 animate-slide-up">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {groupPolicyBadges.map(({ key, icon: Icon, label, tone }) => (
                            <span
                                key={key}
                                className={`badge-pill whitespace-nowrap ${
                                    tone === 'primary'
                                        ? '!bg-primary-500/12 !text-primary-200'
                                        : tone === 'warning'
                                            ? '!bg-amber-500/10 !text-amber-200'
                                            : ''
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {pinnedMessages.length > 0 && (
                <button
                    type="button"
                    onClick={openChatDetails}
                    className="mx-3.5 sm:mx-5 mt-3 rounded-2xl border border-primary-400/12 bg-primary-500/8 px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-primary-500/12 transition-colors animate-slide-up"
                >
                    <div className="min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary-500/14 text-primary-200 flex items-center justify-center flex-shrink-0">
                            <Pin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">
                                {pinnedMessages.length} pinned message{pinnedMessages.length === 1 ? '' : 's'}
                            </p>
                            <p className="text-xs opacity-55 truncate">
                                {getPinnedPreview(pinnedMessages[0])}
                            </p>
                        </div>
                    </div>
                    <span className="badge-pill">Board</span>
                </button>
            )}

            {/* Search Messages Bar */}
            {showSearch && (
                <div className="px-3.5 sm:px-5 py-3 border-b border-white/5 animate-slide-up space-y-3">
                    <input
                        type="text"
                        value={searchMessages}
                        onChange={(e) => setSearchMessages(e.target.value)}
                        placeholder="Search in conversation..."
                        className="input-glass py-2.5 text-sm"
                        autoFocus
                    />
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {searchFilterOptions.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                onClick={() => setSearchFilter(value)}
                                className={`badge-pill whitespace-nowrap transition-all ${searchFilter === value ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''}`}
                                style={searchFilter === value ? { background: 'var(--gradient-primary)' } : undefined}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className={`grid gap-2 ${activeChat?.isGroup ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {activeChat?.isGroup && (
                            <select
                                value={searchSenderId}
                                onChange={(e) => setSearchSenderId(e.target.value)}
                                className="input-glass py-2.5 text-sm"
                            >
                                <option value="">All senders</option>
                                {participants.map((participant) => (
                                    <option key={participant._id} value={participant._id}>
                                        {participant.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <input
                            type="date"
                            value={searchDateFrom}
                            onChange={(e) => setSearchDateFrom(e.target.value)}
                            className="input-glass py-2.5 text-sm"
                        />
                        <input
                            type="date"
                            value={searchDateTo}
                            onChange={(e) => setSearchDateTo(e.target.value)}
                            className="input-glass py-2.5 text-sm"
                        />
                    </div>
                    <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Search Results</p>
                                <p className="text-xs opacity-45">
                                    {isSearchingChatMessages ? 'Searching...' : `${messageSearchResults.length} result${messageSearchResults.length === 1 ? '' : 's'}`}
                                </p>
                            </div>
                            {(searchMessages || searchFilter !== 'all' || searchSenderId || searchDateFrom || searchDateTo) && (
                                <button
                                    onClick={() => {
                                        setSearchMessages('');
                                        setSearchFilter('all');
                                        setSearchSenderId('');
                                        setSearchDateFrom('');
                                        setSearchDateTo('');
                                        clearChatSearch();
                                    }}
                                    className="text-xs opacity-55 hover:opacity-85 transition-opacity"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {isSearchingChatMessages ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="w-5 h-5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                                </div>
                            ) : messageSearchResults.length > 0 ? (
                                messageSearchResults.map((result) => (
                                    <button
                                        key={result._id}
                                        onClick={() => handleOpenSearchResult(result)}
                                        className="w-full px-4 py-3 border-b border-white/6 last:border-b-0 text-left hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3 mb-1">
                                            <p className="text-sm font-medium truncate">
                                                {result.senderId?.name || 'Message'}
                                            </p>
                                            <span className="text-[11px] opacity-40 whitespace-nowrap">
                                                {new Date(result.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(result.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs opacity-55 truncate">
                                            {getSearchResultPreview(result)}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-6 text-sm opacity-50 text-center">
                                    {searchMessages || searchFilter !== 'all' || searchSenderId || searchDateFrom || searchDateTo
                                        ? 'No matching messages found'
                                        : 'Search text, media, documents, links, voice notes, polls, or a date range'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 sm:px-5 py-4 bg-[radial-gradient(ellipse_at_top,_rgba(124,109,255,0.07),_transparent_55%)]"
                style={{ scrollbarGutter: 'stable' }}
            >
                {isPendingRequest && !isRequester && (
                    <div className="mb-4 glass-card p-4 rounded-2xl border border-primary-500/20">
                        <p className="text-sm font-medium mb-2">{otherUser?.name} wants to chat with you</p>
                        <p className="text-xs opacity-55 mb-3">Accept to reply, or reject to remove this request.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
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
                            onClick={requestOlderMessages}
                            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                        >
                            Load older messages
                        </button>
                    </div>
                )}

                {Object.entries(filteredGroups).map(([date, msgs]) => (
                    <div key={date}>
                        {/* Date divider */}
                        <div className="flex items-center justify-center my-5 sticky top-2 sm:top-3 z-[1] pointer-events-none">
                            <span className="floating-separator">
                                {new Date(date).toDateString() === new Date().toDateString()
                                    ? 'Today'
                                    : new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString()
                                        ? 'Yesterday'
                                        : new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        {msgs.map((message, index) => (
                            <div
                                key={message._id}
                                ref={(node) => {
                                    if (node) {
                                        messageRefs.current[message._id] = node;
                                    }
                                }}
                                className={highlightedMessageId === message._id ? 'rounded-[28px] bg-primary-500/8 ring-1 ring-primary-400/30 transition-all duration-300' : ''}
                            >
                                <MessageBubble
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
                                    onOpenUserProfile={(senderUser) => {
                                        if (!senderUser?._id) return;
                                        onProfileClick?.({ mode: 'user', user: senderUser, chat: activeChat });
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                ))}

                {isTyping && <TypingIndicator />}
            </div>

            {/* Scroll-to-bottom FAB */}
            {showScrollFab && (
                <button
                    onClick={() => { scrollToBottom('smooth'); setShowScrollFab(false); }}
                    className="absolute bottom-[100px] right-4 sm:right-6 z-20 w-10 h-10 rounded-full text-white flex items-center justify-center shadow-[0_8px_24px_rgba(124,109,255,0.40)] animate-fab-in hover:scale-110 active:scale-95 transition-transform"
                    style={{ background: 'var(--gradient-primary)' }}
                    title="Scroll to bottom"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            )}

            {/* Message Input */}
            <div ref={messageInputWrapperRef} className="flex-shrink-0">
                <MessageInput
                    chatId={activeChat._id}
                    recipientId={isSavedMessagesChat ? null : otherUser?._id}
                    isGroup={chatInfo.isGroup}
                    isGroupAdmin={isCurrentUserGroupAdmin}
                    groupSettings={groupSettings}
                    disappearingMessages={disappearingMessages}
                    disabled={isPendingRequest && !isRequester}
                />
            </div>
        </div>
    );
}
