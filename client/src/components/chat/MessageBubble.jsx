// client/src/components/chat/MessageBubble.jsx
// Individual message bubble with premium actions, reply previews, and forwarding

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, CheckCheck, Clock3, Download, Edit3, EyeOff, FileText, Forward, Reply, SmilePlus, Star, Trash2, X, Pin } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useReminderStore from '../../store/useReminderStore';
import { formatTime } from '../../utils/formatters';
import { EMOJI_LIST } from '../../utils/constants';
import AvatarFallback from '../ui/AvatarFallback';
import ImagePreview from './ImagePreview';
import ViewOnceMediaViewer from './ViewOnceMediaViewer';

const sameId = (left, right) => String(left || '') === String(right || '');

const getMessageSnippet = (message) => {
    if (!message) return 'Message';
    if (message.isDeleted) return 'Deleted message';
    if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
    if (message.type === 'poll') return message.poll?.question || 'Poll';
    if (message.type === 'image') return message.text || 'Photo';
    if (message.type === 'video') return message.text || 'Video';
    if (message.type === 'audio') return 'Voice message';
    if (message.type === 'document') return message.fileName || message.text || 'Document';
    return message.text || 'Message';
};

export default function MessageBubble({ message, isOwn, otherUser, showAvatar }) {
    const formatDateTimeLocal = (date) => {
        const pad = (value) => `${value}`.padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const [showReactions, setShowReactions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.text);
    const [showImage, setShowImage] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showBookmarkModal, setShowBookmarkModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [forwardQuery, setForwardQuery] = useState('');
    const [isForwarding, setIsForwarding] = useState(false);
    const [isCreatingReminder, setIsCreatingReminder] = useState(false);
    const [isOpeningViewOnce, setIsOpeningViewOnce] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [newCollectionColor, setNewCollectionColor] = useState('#6f6bff');
    const [customReminderAt, setCustomReminderAt] = useState(() => formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    const [viewOnceViewer, setViewOnceViewer] = useState(null);
    const { emitReaction, emitDeleteMessage, emitEditMessage } = useSocket();
    const { user } = useAuthStore();
    const {
        votePoll,
        setReplyingTo,
        toggleStarMessage,
        togglePinMessage,
        forwardMessage,
        ensureSavedMessagesChat,
        fetchBookmarkCollections,
        createBookmarkCollection,
        toggleMessageInBookmarkCollection,
        bookmarkCollections,
        isLoadingBookmarkCollections,
        chats,
        openViewOnceMessage,
    } = useChatStore();
    const { createReminder } = useReminderStore();
    const bookmarkColorOptions = ['#6f6bff', '#12b981', '#f97316', '#06b6d4', '#ec4899'];

    const sender = message.senderId || {};
    const pollOptions = message.poll?.options || [];
    const totalVotes = pollOptions.reduce((sum, option) => sum + (option.votes?.length || 0), 0);
    const selectedOptionId = pollOptions.find((option) =>
        option.votes?.some((vote) => sameId(vote?._id || vote, user?._id))
    )?.optionId;
    const isStarred = (message.starredBy || []).some((entry) => sameId(entry?._id || entry, user?._id));
    const isPinnedMessage = !!message.isPinned;
    const isViewOnceMedia = !!message.viewOnce?.enabled && ['image', 'video'].includes(message.type);
    const hasViewedViewOnce = !!message.viewOnce?.hasViewed || (message.viewOnce?.views || []).some((entry) => sameId(entry?.userId?._id || entry?.userId, user?._id));
    const viewOnceLabel = message.type === 'video' ? 'View once video' : 'View once photo';

    useEffect(() => {
        if (!showBookmarkModal) return;
        fetchBookmarkCollections().catch(() => { });
    }, [showBookmarkModal, fetchBookmarkCollections]);

    const forwardTargets = useMemo(() => {
        const normalizedQuery = forwardQuery.trim().toLowerCase();

        return (chats || [])
            .map((chat) => {
                if (!chat || sameId(chat._id, message.chatId)) return null;

                if (chat.isSavedMessages) {
                    return {
                        chatId: chat._id,
                        name: 'Saved Messages',
                        subtitle: 'Personal cloud',
                        avatar: '',
                        isGroup: false,
                        isSavedMessages: true,
                    };
                }

                if (chat.isGroup) {
                    return {
                        chatId: chat._id,
                        name: chat.groupName || 'Group Chat',
                        subtitle: `${(chat.participants || []).filter(Boolean).length} members`,
                        avatar: chat.groupAvatar,
                        isGroup: true,
                    };
                }

                const participant = (chat.participants || []).filter(Boolean).find((entry) => !sameId(entry._id, user?._id));
                if (!participant) return null;

                return {
                    chatId: chat._id,
                    name: participant.name || 'User',
                    subtitle: participant.username ? `@${participant.username}` : 'Direct chat',
                    avatar: participant.avatar,
                    isGroup: false,
                };
            })
            .filter(Boolean)
            .filter((target) => {
                if (!normalizedQuery) return true;
                return target.name.toLowerCase().includes(normalizedQuery) || target.subtitle.toLowerCase().includes(normalizedQuery);
            });
    }, [chats, forwardQuery, message.chatId, user?._id]);

    if (message.isDeleted) {
        return (
            <div className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-xl text-xs italic opacity-40 ${isOwn ? 'bubble-sent opacity-50' : 'bubble-received opacity-50'}`}>
                    This message was deleted
                </div>
            </div>
        );
    }

    const handleReaction = (emoji) => {
        emitReaction(message._id, emoji, otherUser?._id);
        setShowReactions(false);
    };

    const handleDelete = (type = 'me') => {
        emitDeleteMessage(message._id, message.chatId, otherUser?._id, type);
    };

    const handleEdit = () => {
        if (editText.trim() && editText !== message.text) {
            emitEditMessage(message._id, editText, otherUser?._id);
        }
        setIsEditing(false);
    };

    const handleForward = async (targetChatId) => {
        if (isForwarding) return;
        setIsForwarding(true);
        try {
            await forwardMessage(message._id, targetChatId);
            setShowForwardModal(false);
            setForwardQuery('');
        } finally {
            setIsForwarding(false);
        }
    };

    const handleSaveToSavedMessages = async () => {
        if (isForwarding) return;
        setIsForwarding(true);
        try {
            const savedChat = await ensureSavedMessagesChat();
            await forwardMessage(message._id, savedChat._id);
        } finally {
            setIsForwarding(false);
        }
    };

    const handleOpenBookmarkModal = () => {
        setShowBookmarkModal(true);
    };

    const handleCreateReminderAt = async (remindAt) => {
        setIsCreatingReminder(true);
        try {
            await createReminder({
                messageId: message._id,
                remindAt,
            });
            setShowReminderModal(false);
        } finally {
            setIsCreatingReminder(false);
        }
    };

    const handleCreateCollection = async () => {
        const normalizedName = newCollectionName.trim();
        if (!normalizedName) return;

        const collection = await createBookmarkCollection({
            name: normalizedName,
            color: newCollectionColor,
        });

        setNewCollectionName('');
        await toggleMessageInBookmarkCollection(collection._id, message._id);
    };

    const isMessageBookmarkedInCollection = (collection) =>
        (collection?.items || []).some((item) => sameId(item.messageId?._id || item.messageId, message._id));

    const handleOpenViewOnce = async () => {
        if (isOwn || hasViewedViewOnce || isOpeningViewOnce) return;

        setIsOpeningViewOnce(true);
        try {
            const data = await openViewOnceMessage(message._id);
            setViewOnceViewer({
                mediaUrl: data.mediaUrl,
                type: data.type,
                durationSeconds: data.durationSeconds,
            });
        } finally {
            setIsOpeningViewOnce(false);
        }
    };

    const statusIcon = () => {
        if (!isOwn) return null;

        switch (message.status) {
            case 'seen':
                return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
            case 'delivered':
                return <CheckCheck className="w-3.5 h-3.5 opacity-50" />;
            default:
                return <Check className="w-3.5 h-3.5 opacity-50" />;
        }
    };

    return (
        <>
            <div className={`flex mb-1.5 ${isOwn ? 'justify-end' : 'justify-start'} group animate-slide-up`}>
                {!isOwn && showAvatar && (
                    <div className="w-7 h-7 rounded-full overflow-hidden mr-2 mt-auto flex-shrink-0" title={sender.name}>
                        {sender.avatar ? (
                            <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                        ) : (
                            <AvatarFallback name={sender.name} className="text-[10px]" />
                        )}
                    </div>
                )}
                {!isOwn && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}

                <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] relative min-w-0">
                    <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
                        <button
                            onClick={() => setShowReactions((value) => !value)}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="React"
                        >
                            <SmilePlus className="w-3.5 h-3.5 opacity-40" />
                        </button>
                        <button
                            onClick={() => setReplyingTo(message)}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="Reply"
                        >
                            <Reply className="w-3.5 h-3.5 opacity-40" />
                        </button>
                        <button
                            onClick={() => toggleStarMessage(message._id)}
                            className={`p-1 rounded-lg transition-colors ${isStarred ? 'text-amber-300 hover:bg-amber-400/10' : 'hover:bg-white/10'}`}
                            title={isStarred ? 'Unstar' : 'Star'}
                        >
                            <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : 'opacity-40'}`} />
                        </button>
                        {!isViewOnceMedia && (
                            <button
                                onClick={() => setShowForwardModal(true)}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                title="Forward"
                            >
                                <Forward className="w-3.5 h-3.5 opacity-40" />
                            </button>
                        )}
                        {!isViewOnceMedia && (
                            <button
                                onClick={() => togglePinMessage(message._id)}
                                className={`p-1 rounded-lg transition-colors ${isPinnedMessage ? 'text-primary-200 hover:bg-primary-500/10' : 'hover:bg-white/10'}`}
                                title={isPinnedMessage ? 'Unpin' : 'Pin'}
                            >
                                <Pin className={`w-3.5 h-3.5 ${isPinnedMessage ? '' : 'opacity-40'}`} />
                            </button>
                        )}
                        <button
                            onClick={handleOpenBookmarkModal}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="Bookmarks"
                        >
                            <Bookmark className="w-3.5 h-3.5 opacity-40" />
                        </button>
                        <button
                            onClick={() => setShowReminderModal(true)}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                            title="Remind me"
                        >
                            <Clock3 className="w-3.5 h-3.5 opacity-40" />
                        </button>
                        {isOwn && message.type === 'text' && (
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setEditText(message.text);
                                }}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                title="Edit"
                            >
                                <Edit3 className="w-3.5 h-3.5 opacity-40" />
                            </button>
                        )}
                        {isOwn && (
                            <>
                                <button
                                    onClick={() => handleDelete('me')}
                                    className="p-1 rounded-lg hover:bg-red-500/10 transition-colors group/del"
                                    title="Delete for me"
                                >
                                    <Trash2 className="w-3.5 h-3.5 opacity-40 group-hover/del:text-red-400" />
                                </button>
                                <button
                                    onClick={() => handleDelete('everyone')}
                                    className="p-1 rounded-lg hover:bg-red-500/10 transition-colors group/del-all"
                                    title="Delete for everyone"
                                >
                                    <Trash2 className="w-3.5 h-3.5 opacity-40 text-red-400/50 group-hover/del-all:text-red-500" />
                                </button>
                            </>
                        )}
                    </div>

                    {showReactions && (
                        <div className={`absolute bottom-full mb-1 ${isOwn ? 'right-0' : 'left-0'} glass-card p-1.5 flex gap-1 z-20 animate-bounce-in`}>
                            {EMOJI_LIST.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => handleReaction(emoji)}
                                    className="p-1 rounded-lg hover:bg-white/10 transition-transform hover:scale-125 text-lg"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={`${isOwn ? 'bubble-sent' : 'bubble-received'} px-3.5 py-2`}>
                        {isPinnedMessage && (
                            <div className="mb-2 flex items-center gap-1.5">
                                <Pin className="w-3 h-3 text-primary-200" />
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-200/80">
                                    Pinned
                                </p>
                            </div>
                        )}
                        {message.forwardedFrom?.senderName && (
                            <div className="mb-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300/80">
                                    Forwarded from {message.forwardedFrom.senderName}
                                </p>
                            </div>
                        )}

                        {message.replyTo && (
                            <div className="mb-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                                <p className="text-[11px] font-semibold text-primary-300">
                                    {message.replyTo.senderId?.name || 'Original message'}
                                </p>
                                <p className="text-xs opacity-65 truncate">
                                    {getMessageSnippet(message.replyTo)}
                                </p>
                            </div>
                        )}

                        {(message.type === 'document' || (!message.type && !message.imageUrl && !message.videoUrl && message.fileUrl)) && (
                            <div className="message-document mb-1.5 glass-card-dark p-3 rounded-lg flex items-center gap-3 min-w-0 sm:min-w-[200px]">
                                <div className="p-2.5 bg-white/10 rounded-lg">
                                    <FileText className="w-6 h-6 text-primary-300" />
                                </div>
                                <div className="flex-1 min-w-0 pr-2">
                                    <p className="text-sm font-medium truncate text-white">{message.fileName || 'Document'}</p>
                                    <p className="text-[10px] text-white/50">
                                        {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(2)} MB` : 'File'}
                                    </p>
                                </div>
                                <a
                                    href={message.fileUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <Download className="w-5 h-5 text-white/70" />
                                </a>
                            </div>
                        )}

                        {isViewOnceMedia && (
                            <button
                                type="button"
                                onClick={handleOpenViewOnce}
                                disabled={isOwn || hasViewedViewOnce || isOpeningViewOnce}
                                className={`mb-2 w-full rounded-[22px] border px-4 py-4 text-left transition-all ${isOwn ? 'border-white/10 bg-black/10 cursor-default' : hasViewedViewOnce ? 'border-white/10 bg-black/10 cursor-default' : 'border-primary-400/20 bg-primary-500/10 hover:border-primary-300/35 hover:bg-primary-500/14'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-[0_12px_28px_rgba(111,107,255,0.2)]"
                                        style={{ background: 'var(--gradient-primary)' }}>
                                        <EyeOff className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{viewOnceLabel}</p>
                                        <p className="text-xs opacity-55 mt-1">
                                            {isOwn
                                                ? (message.viewOnce?.views || []).length > 0
                                                    ? `Opened ${(message.viewOnce?.views || []).length} time${(message.viewOnce?.views || []).length === 1 ? '' : 's'}`
                                                    : 'Can be opened once by each recipient'
                                                : hasViewedViewOnce
                                                    ? `${message.type === 'video' ? 'Video' : 'Photo'} viewed`
                                                    : isOpeningViewOnce
                                                        ? 'Opening protected media...'
                                                        : 'Tap to open'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )}

                        {(message.type === 'image' || message.imageUrl) && !isViewOnceMedia && (
                            <div className="message-image mb-1.5 -mx-1 -mt-0.5" onClick={() => setShowImage(true)}>
                                <img
                                    src={message.fileUrl || message.imageUrl}
                                    alt="Shared image"
                                    className="rounded-lg w-full"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {(message.type === 'video' || message.videoUrl) && !isViewOnceMedia && (
                            <div className="message-video mb-1.5 -mx-1 -mt-0.5 relative group/video">
                                <video
                                    src={message.fileUrl || message.videoUrl}
                                    className="rounded-lg w-full max-h-[300px] object-cover"
                                    controls
                                    preload="metadata"
                                />
                            </div>
                        )}

                        {message.type === 'audio' && (
                            <div className="mb-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 min-w-[220px]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300/80 mb-2">
                                    Voice message
                                </p>
                                <audio
                                    src={message.fileUrl}
                                    controls
                                    preload="metadata"
                                    className="w-full h-10"
                                />
                            </div>
                        )}

                        {message.type === 'poll' && message.poll?.question && (
                            <div className="mb-1.5 min-w-0 sm:min-w-[240px]">
                                <p className="text-sm font-semibold mb-2">{message.poll.question}</p>
                                <div className="space-y-2">
                                    {pollOptions.map((option) => {
                                        const voteCount = option.votes?.length || 0;
                                        const percentage = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0;
                                        const isSelected = selectedOptionId === option.optionId;

                                        return (
                                            <button
                                                key={option.optionId}
                                                onClick={() => votePoll(message._id, option.optionId)}
                                                className={`w-full text-left relative overflow-hidden rounded-xl border px-3 py-2 transition-all ${isSelected ? 'border-primary-400/60 bg-primary-500/10' : 'border-white/10 hover:bg-white/5'}`}
                                            >
                                                <div
                                                    className="absolute inset-y-0 left-0 rounded-xl opacity-60"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        background: isSelected ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.08)',
                                                    }}
                                                />
                                                <div className="relative flex items-center justify-between gap-3">
                                                    <span className="text-sm">{option.text}</span>
                                                    <span className="text-xs opacity-60">{voteCount} vote{voteCount === 1 ? '' : 's'}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] opacity-45 mt-2">
                                    {totalVotes} total vote{totalVotes === 1 ? '' : 's'}
                                </p>
                            </div>
                        )}

                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                                    className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-sm outline-none"
                                    autoFocus
                                />
                                <button onClick={handleEdit} className="text-xs text-primary-300">Save</button>
                                <button onClick={() => setIsEditing(false)}>
                                    <X className="w-3.5 h-3.5 opacity-50" />
                                </button>
                            </div>
                        ) : (
                            message.text && (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                    {message.text}
                                </p>
                            )
                        )}

                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            {isStarred && (
                                <Star className="w-3 h-3 text-amber-300 fill-current" />
                            )}
                            {isPinnedMessage && (
                                <Pin className="w-3 h-3 text-primary-200" />
                            )}
                            {message.isEdited && (
                                <span className="text-[10px] opacity-40 italic">edited</span>
                            )}
                            <span className={`text-[10px] ${isOwn ? 'opacity-60' : 'opacity-40'}`}>
                                {formatTime(message.createdAt)}
                            </span>
                            {statusIcon()}
                        </div>
                    </div>

                    {message.reactions?.length > 0 && (
                        <div className={`flex gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {message.reactions.map((reaction, index) => (
                                <span
                                    key={`${reaction.emoji}-${index}`}
                                    onClick={() => handleReaction(reaction.emoji)}
                                    className="text-sm px-1.5 py-0.5 glass-card rounded-full cursor-pointer hover:scale-110 transition-transform"
                                    title={reaction.userId?.name || 'Someone'}
                                >
                                    {reaction.emoji}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showForwardModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={() => setShowForwardModal(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md glass-panel rounded-[28px] border border-white/10 p-4 sm:p-5 animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold">Forward message</h3>
                                <p className="text-xs opacity-45 mt-1">Choose a chat to forward this message to.</p>
                            </div>
                            <button onClick={() => setShowForwardModal(false)} className="p-2 rounded-xl hover:bg-white/5">
                                <X className="w-4 h-4 opacity-60" />
                            </button>
                        </div>

                        <input
                            type="text"
                            value={forwardQuery}
                            onChange={(event) => setForwardQuery(event.target.value)}
                            placeholder="Search chats..."
                            className="input-glass py-2.5 text-sm mb-3"
                        />

                        <div className="max-h-72 overflow-y-auto space-y-2">
                            {forwardTargets.map((target) => (
                                <button
                                    key={target.chatId}
                                    onClick={() => handleForward(target.chatId)}
                                    disabled={isForwarding}
                                    className="w-full flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-left hover:bg-white/8 transition-colors disabled:opacity-60"
                                >
                                    <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                        {target.avatar ? (
                                            <img src={target.avatar} alt={target.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <AvatarFallback name={target.name} className="text-sm" variant={target.isGroup ? 'group' : 'person'} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{target.name}</p>
                                        <p className="text-xs opacity-45 truncate">{target.subtitle}</p>
                                    </div>
                                    <Forward className="w-4 h-4 opacity-40" />
                                </button>
                            ))}

                            {forwardTargets.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-sm opacity-55">
                                    No other chats available to forward this message to.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showBookmarkModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={() => setShowBookmarkModal(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md glass-panel rounded-[28px] border border-white/10 p-4 sm:p-5 animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold">Bookmark collections</h3>
                                <p className="text-xs opacity-45 mt-1">Organize important messages into reusable collections, or quick-save to Saved Messages.</p>
                            </div>
                            <button onClick={() => setShowBookmarkModal(false)} className="p-2 rounded-xl hover:bg-white/5">
                                <X className="w-4 h-4 opacity-60" />
                            </button>
                        </div>

                        <button
                            onClick={async () => {
                                await handleSaveToSavedMessages();
                                setShowBookmarkModal(false);
                            }}
                            className="w-full mb-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left hover:bg-white/8 transition-colors"
                        >
                            <p className="text-sm font-semibold">Quick save to Saved Messages</p>
                            <p className="text-xs opacity-45 mt-1">Keep a personal copy in your private cloud chat.</p>
                        </button>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-3 mb-3">
                            <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Create collection</p>
                            <input
                                type="text"
                                value={newCollectionName}
                                onChange={(event) => setNewCollectionName(event.target.value)}
                                placeholder="Launch ideas, receipts, client notes..."
                                className="input-glass py-2.5 text-sm mb-3"
                            />
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {bookmarkColorOptions.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewCollectionColor(color)}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform ${newCollectionColor === color ? 'scale-110 border-white/70' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleCreateCollection}
                                    className="btn-primary px-3 py-2 text-sm"
                                    disabled={!newCollectionName.trim()}
                                >
                                    Create
                                </button>
                            </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-2">
                            {isLoadingBookmarkCollections ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                                </div>
                            ) : bookmarkCollections.length > 0 ? (
                                bookmarkCollections.map((collection) => {
                                    const isSaved = isMessageBookmarkedInCollection(collection);
                                    return (
                                        <button
                                            key={collection._id}
                                            onClick={() => toggleMessageInBookmarkCollection(collection._id, message._id)}
                                            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${isSaved ? 'border-primary-400/25 bg-primary-500/10' : 'border-white/8 bg-white/5 hover:bg-white/8'}`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: collection.color || '#6f6bff' }} />
                                                    <p className="text-sm font-semibold truncate">{collection.name}</p>
                                                </div>
                                                <p className="text-xs opacity-45 mt-1">
                                                    {(collection.items || []).length} saved message{(collection.items || []).length === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                            {isSaved ? <Check className="w-4 h-4 text-primary-300 flex-shrink-0" /> : <Bookmark className="w-4 h-4 opacity-35 flex-shrink-0" />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-sm opacity-55">
                                    Create a collection to start grouping important messages.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showReminderModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={() => setShowReminderModal(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md glass-panel rounded-[28px] border border-white/10 p-4 sm:p-5 animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold">Remind me later</h3>
                                <p className="text-xs opacity-45 mt-1">Bring this message back exactly when you need to revisit it.</p>
                            </div>
                            <button onClick={() => setShowReminderModal(false)} className="p-2 rounded-xl hover:bg-white/5">
                                <X className="w-4 h-4 opacity-60" />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {[
                                { label: 'In 1 hour', date: new Date(Date.now() + 60 * 60 * 1000) },
                                { label: 'Tonight', date: (() => { const next = new Date(); next.setHours(20, 0, 0, 0); if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1); return next; })() },
                                { label: 'Tomorrow morning', date: (() => { const next = new Date(); next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); return next; })() },
                                { label: 'Next week', date: (() => { const next = new Date(); next.setDate(next.getDate() + 7); next.setHours(9, 0, 0, 0); return next; })() },
                            ].map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handleCreateReminderAt(preset.date.toISOString())}
                                    disabled={isCreatingReminder}
                                    className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left hover:bg-white/8 transition-colors disabled:opacity-50"
                                >
                                    <p className="text-sm font-semibold">{preset.label}</p>
                                    <p className="text-xs opacity-45 mt-1">
                                        {preset.date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                            <label className="text-xs uppercase tracking-[0.18em] opacity-40 block mb-2">Custom time</label>
                            <input
                                type="datetime-local"
                                value={customReminderAt}
                                min={formatDateTimeLocal(new Date(Date.now() + 60000))}
                                onChange={(event) => setCustomReminderAt(event.target.value)}
                                className="input-glass py-2.5 text-sm mb-3"
                            />
                            <button
                                onClick={() => handleCreateReminderAt(new Date(customReminderAt).toISOString())}
                                disabled={isCreatingReminder || !customReminderAt}
                                className="btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-40"
                            >
                                Create reminder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showImage && (
                <ImagePreview
                    imageUrl={message.fileUrl || message.imageUrl}
                    onClose={() => setShowImage(false)}
                />
            )}

            {viewOnceViewer && (
                <ViewOnceMediaViewer
                    mediaUrl={viewOnceViewer.mediaUrl}
                    type={viewOnceViewer.type}
                    durationSeconds={viewOnceViewer.durationSeconds}
                    onClose={() => setViewOnceViewer(null)}
                />
            )}
        </>
    );
}
