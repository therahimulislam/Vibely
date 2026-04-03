// client/src/components/chat/MessageBubble.jsx
// Premium Aurora Dark message bubble with tails, floating action pill, reactions

import { useEffect, useMemo, useState } from 'react';
import {
    Bookmark, Check, CheckCheck, Clock3, Download, Edit3, EyeOff,
    FileText, Forward, Info, Reply, SmilePlus, Star, Trash2, X, Pin
} from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useReminderStore from '../../store/useReminderStore';
import useLongPress from '../../hooks/useLongPress';
import { formatTime } from '../../utils/formatters';
import { EMOJI_LIST } from '../../utils/constants';
import AvatarFallback from '../ui/AvatarFallback';
import ImagePreview from './ImagePreview';
import ViewOnceMediaViewer from './ViewOnceMediaViewer';
import MessageContextSheet from './MessageContextSheet';

const sameId = (l, r) => String(l || '') === String(r || '');
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const getMessageSnippet = (msg) => {
    if (!msg) return 'Message';
    if (msg.isDeleted) return 'Deleted message';
    if (msg.viewOnce?.enabled) return msg.type === 'video' ? 'View once video' : 'View once photo';
    if (msg.type === 'poll') return msg.poll?.question || 'Poll';
    if (msg.type === 'image') return msg.text || 'Photo';
    if (msg.type === 'video') return msg.text || 'Video';
    if (msg.type === 'audio') return 'Voice message';
    if (msg.type === 'document') return msg.fileName || msg.text || 'Document';
    return msg.text || 'Message';
};

const canEditOwnMessage = (message, isOwn) => {
    if (!isOwn || !message || message.type !== 'text' || message.isDeleted) return false;
    const createdAt = new Date(message.createdAt).getTime();
    if (Number.isNaN(createdAt)) return false;
    return Date.now() - createdAt <= EDIT_WINDOW_MS;
};

const formatFullDateTime = (value) => {
    if (!value) return 'Unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unavailable';
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

// Compact emoji reaction clusters
function ReactionList({ reactions, onReact }) {
    const groups = reactions.reduce((acc, r) => {
        const key = r.emoji;
        acc[key] = acc[key] || { emoji: key, count: 0, users: [] };
        acc[key].count += 1;
        acc[key].users.push(r.userId?.name || '');
        return acc;
    }, {});

    return Object.values(groups).map(({ emoji, count, users }) => (
        <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className="reaction-pill"
            title={users.filter(Boolean).join(', ')}
        >
            <span>{emoji}</span>
            {count > 1 && <span className="text-[10px] font-semibold opacity-70">{count}</span>}
        </button>
    ));
}

export default function MessageBubble({ message, isOwn, otherUser, showAvatar, onOpenUserProfile }) {
    const formatDateTimeLocal = (d) => {
        const p = (v) => `${v}`.padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    const [showReactions, setShowReactions] = useState(false);
    const [showContextSheet, setShowContextSheet] = useState(false);
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
    const [newCollectionColor, setNewCollectionColor] = useState('#7c6dff');
    const [customReminderAt, setCustomReminderAt] = useState(() => formatDateTimeLocal(new Date(Date.now() + 3600000)));
    const [viewOnceViewer, setViewOnceViewer] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [messageInfo, setMessageInfo] = useState(null);
    const [isLoadingMessageInfo, setIsLoadingMessageInfo] = useState(false);

    const longPressHandlers = useLongPress(() => setShowContextSheet(true), 480);

    const { emitReaction, emitDeleteMessage, emitEditMessage } = useSocket();
    const { user } = useAuthStore();
    const {
        votePoll, setReplyingTo, toggleStarMessage, togglePinMessage,
        forwardMessage, ensureSavedMessagesChat, fetchBookmarkCollections,
        createBookmarkCollection, toggleMessageInBookmarkCollection,
        bookmarkCollections, isLoadingBookmarkCollections, chats, openViewOnceMessage, fetchMessageInfo,
    } = useChatStore();
    const { createReminder } = useReminderStore();
    const bookmarkColorOptions = ['#7c6dff', '#10b981', '#f97316', '#06b6d4', '#ec4899'];

    const sender = message.senderId || {};
    const pollOptions = message.poll?.options || [];
    const totalVotes = pollOptions.reduce((s, o) => s + (o.votes?.length || 0), 0);
    const selectedOptionId = pollOptions.find(o => o.votes?.some(v => sameId(v?._id || v, user?._id)))?.optionId;
    const isStarred = (message.starredBy || []).some(e => sameId(e?._id || e, user?._id));
    const isPinnedMessage = !!message.isPinned;
    const isViewOnceMedia = !!message.viewOnce?.enabled && ['image', 'video'].includes(message.type);
    const hasViewedViewOnce = !!message.viewOnce?.hasViewed || (message.viewOnce?.views || []).some(e => sameId(e?.userId?._id || e?.userId, user?._id));
    const viewOnceLabel = message.type === 'video' ? 'View once video' : 'View once photo';
    const canEditMessage = canEditOwnMessage(message, isOwn);

    useEffect(() => {
        if (!showBookmarkModal) return;
        fetchBookmarkCollections().catch(() => {});
    }, [showBookmarkModal, fetchBookmarkCollections]);

    useEffect(() => {
        setEditText(message.text || '');
        if (!canEditMessage) {
            setIsEditing(false);
        }
    }, [message.text, canEditMessage]);

    const forwardTargets = useMemo(() => {
        const q = forwardQuery.trim().toLowerCase();
        return (chats || []).map(chat => {
            if (!chat || sameId(chat._id, message.chatId)) return null;
            if (chat.isSavedMessages) return { chatId: chat._id, name: 'Saved Messages', subtitle: 'Personal cloud', avatar: '', isGroup: false, isSavedMessages: true };
            if (chat.isGroup) return { chatId: chat._id, name: chat.groupName || 'Group Chat', subtitle: `${(chat.participants || []).filter(Boolean).length} members`, avatar: chat.groupAvatar, isGroup: true };
            const p = (chat.participants || []).filter(Boolean).find(e => !sameId(e._id, user?._id));
            if (!p) return null;
            return { chatId: chat._id, name: p.name || 'User', subtitle: p.username ? `@${p.username}` : 'Direct', avatar: p.avatar, isGroup: false };
        }).filter(Boolean).filter(t => !q || t.name.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q));
    }, [chats, forwardQuery, message.chatId, user?._id]);

    if (message.isDeleted) {
        return (
            <div className={`flex mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <p className="text-xs italic opacity-35 px-4 py-1.5 rounded-full border border-white/8 bg-white/4">
                    This message was deleted
                </p>
            </div>
        );
    }

    const handleReaction = (emoji) => { emitReaction(message._id, emoji, otherUser?._id); setShowReactions(false); };
    const handleDelete = (type = 'me') => emitDeleteMessage(message._id, message.chatId, otherUser?._id, type);
    const handleEdit = () => {
        if (!canEditMessage) {
            setIsEditing(false);
            return;
        }
        if (editText.trim() && editText !== message.text) emitEditMessage(message._id, editText, otherUser?._id);
        setIsEditing(false);
    };
    const handleForward = async (chatId) => {
        if (isForwarding) return;
        setIsForwarding(true);
        try { await forwardMessage(message._id, chatId); setShowForwardModal(false); setForwardQuery(''); } finally { setIsForwarding(false); }
    };
    const handleSaveToSaved = async () => {
        if (isForwarding) return;
        setIsForwarding(true);
        try { const c = await ensureSavedMessagesChat(); await forwardMessage(message._id, c._id); } finally { setIsForwarding(false); }
    };
    const handleCreateReminderAt = async (remindAt) => {
        setIsCreatingReminder(true);
        try { await createReminder({ messageId: message._id, remindAt }); setShowReminderModal(false); } finally { setIsCreatingReminder(false); }
    };
    const handleCreateCollection = async () => {
        const name = newCollectionName.trim();
        if (!name) return;
        const col = await createBookmarkCollection({ name, color: newCollectionColor });
        setNewCollectionName('');
        await toggleMessageInBookmarkCollection(col._id, message._id);
    };
    const isBookmarkedIn = (col) => (col?.items || []).some(i => sameId(i.messageId?._id || i.messageId, message._id));
    const handleOpenViewOnce = async () => {
        if (isOwn || hasViewedViewOnce || isOpeningViewOnce) return;
        setIsOpeningViewOnce(true);
        try { const d = await openViewOnceMessage(message._id); setViewOnceViewer({ mediaUrl: d.mediaUrl, type: d.type, durationSeconds: d.durationSeconds }); } finally { setIsOpeningViewOnce(false); }
    };
    const handleOpenInfo = async () => {
        setShowInfoModal(true);
        setIsLoadingMessageInfo(true);
        try {
            const info = await fetchMessageInfo(message._id);
            setMessageInfo(info);
        } catch (error) {
            setShowInfoModal(false);
        } finally {
            setIsLoadingMessageInfo(false);
        }
    };

    const StatusIcon = () => {
        if (!isOwn) return null;
        if (message.status === 'seen') return <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />;
        if (message.status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 opacity-45" />;
        return <Check className="w-3.5 h-3.5 opacity-45" />;
    };

    return (
        <>
            <div className={`flex mb-1 ${isOwn ? 'justify-end' : 'justify-start'} group animate-slide-up`}>
                {/* Received avatar — clickable → open profile */}
                {!isOwn && showAvatar && (
                    <button
                        type="button"
                        className="w-7 h-7 rounded-full overflow-hidden mr-2 mt-auto flex-shrink-0 ring-1 ring-white/10 hover:ring-primary-400/40 transition-all"
                        title={sender.name}
                        onClick={() => onOpenUserProfile?.(sender)}
                    >
                        {sender.avatar
                            ? <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                            : <AvatarFallback name={sender.name} className="text-[9px]" />}
                    </button>
                )}
                {!isOwn && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}

                {/* Long-press wrapper */}
                <div
                    className={`max-w-[82%] sm:max-w-[72%] lg:max-w-[65%] relative min-w-0 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    {...longPressHandlers}
                    onContextMenu={e => { e.preventDefault(); setShowContextSheet(true); }}
                >

                    {/* ── Floating action pill — appears above bubble on hover ── */}
                    <div className={`absolute -top-9 ${isOwn ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 pointer-events-none group-hover:pointer-events-auto`}>
                        <div className="msg-action-pill">
                            <ActionBtn icon={<SmilePlus className="w-3.5 h-3.5" />} title="React" onClick={() => setShowReactions(v => !v)} />
                            <ActionBtn icon={<Reply className="w-3.5 h-3.5" />} title="Reply" onClick={() => setReplyingTo(message)} />
                            <ActionBtn
                                icon={<Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-300 text-amber-300' : ''}`} />}
                                title={isStarred ? 'Unstar' : 'Star'}
                                onClick={() => toggleStarMessage(message._id)}
                            />
                            {!isViewOnceMedia && <ActionBtn icon={<Forward className="w-3.5 h-3.5" />} title="Forward" onClick={() => setShowForwardModal(true)} />}
                            {!isViewOnceMedia && (
                                <ActionBtn
                                    icon={<Pin className={`w-3.5 h-3.5 ${isPinnedMessage ? 'text-primary-300' : ''}`} />}
                                    title={isPinnedMessage ? 'Unpin' : 'Pin'}
                                    onClick={() => togglePinMessage(message._id)}
                                />
                            )}
                            <ActionBtn icon={<Bookmark className="w-3.5 h-3.5" />} title="Bookmark" onClick={() => setShowBookmarkModal(true)} />
                            <ActionBtn icon={<Clock3 className="w-3.5 h-3.5" />} title="Remind me" onClick={() => setShowReminderModal(true)} />
                            {isOwn && <ActionBtn icon={<Info className="w-3.5 h-3.5" />} title="Info" onClick={handleOpenInfo} />}
                            {isOwn && message.type === 'text' && canEditMessage && (
                                <ActionBtn icon={<Edit3 className="w-3.5 h-3.5" />} title="Edit" onClick={() => { setIsEditing(true); setEditText(message.text); }} />
                            )}
                            {isOwn && (
                                <>
                                    <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} title="Delete for me" danger onClick={() => handleDelete('me')} />
                                    <ActionBtn icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />} title="Delete for everyone" danger onClick={() => handleDelete('everyone')} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Reaction picker — scrollable for large emoji list */}
                    {showReactions && (
                        <div className={`absolute -top-14 ${isOwn ? 'right-0' : 'left-0'} glass-card z-30 animate-bounce-in`}
                            style={{ width: 'min(320px, 90vw)' }}>
                            <div className="flex flex-wrap gap-0.5 p-2 max-h-36 overflow-y-auto">
                                {EMOJI_LIST.map(emoji => (
                                    <button key={emoji} onClick={() => handleReaction(emoji)}
                                        className="p-1.5 rounded-xl hover:bg-white/10 transition-transform hover:scale-125 text-lg leading-none">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sender name (group) */}
                    {!isOwn && showAvatar && sender.name && (
                        <p className="text-[11px] font-semibold opacity-55 ml-1 mb-0.5">{sender.name}</p>
                    )}

                    {/* Bubble */}
                    <div className={`${isOwn ? 'bubble-sent' : 'bubble-received'} px-3.5 py-2.5`}>

                        {isPinnedMessage && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <Pin className="w-3 h-3 text-white/50" />
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Pinned</span>
                            </div>
                        )}

                        {message.forwardedFrom?.senderName && (
                            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/10">
                                <Forward className="w-3 h-3 opacity-50" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest opacity-50">
                                    Forwarded from {message.forwardedFrom.senderName}
                                </span>
                            </div>
                        )}

                        {/* Reply preview */}
                        {message.replyTo && (
                            <div className="mb-2.5 rounded-[14px] overflow-hidden" style={{
                                background: isOwn ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)',
                                borderLeft: '3px solid rgba(124,109,255,0.7)',
                            }}>
                                <div className="px-3 py-2">
                                    <p className="text-[11px] font-bold text-primary-300 mb-0.5">
                                        {message.replyTo.senderId?.name || 'Original message'}
                                    </p>
                                    <p className="text-xs opacity-60 truncate">{getMessageSnippet(message.replyTo)}</p>
                                </div>
                            </div>
                        )}

                        {/* Document */}
                        {(message.type === 'document' || (!message.type && message.fileUrl && !message.imageUrl && !message.videoUrl)) && (
                            <div className="flex items-center gap-3 mb-1.5 rounded-[16px] overflow-hidden p-3"
                                style={{ background: isOwn ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'rgba(124,109,255,0.25)' }}>
                                    <FileText className="w-5 h-5 text-primary-200" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{message.fileName || 'Document'}</p>
                                    <p className="text-[11px] opacity-50 mt-0.5">
                                        {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(2)} MB` : 'File'}
                                    </p>
                                </div>
                                <a href={message.fileUrl} download target="_blank" rel="noopener noreferrer"
                                    className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0">
                                    <Download className="w-4 h-4 opacity-60" />
                                </a>
                            </div>
                        )}

                        {/* View-once media */}
                        {isViewOnceMedia && (
                            <button type="button" onClick={handleOpenViewOnce}
                                disabled={isOwn || hasViewedViewOnce || isOpeningViewOnce}
                                className={`mb-2 w-full rounded-[16px] border px-4 py-3.5 text-left transition-all ${
                                    isOwn || hasViewedViewOnce
                                        ? 'border-white/8 cursor-default opacity-75'
                                        : 'border-primary-400/25 hover:border-primary-300/40 hover:bg-primary-500/10'
                                }`}
                                style={{ background: isOwn || hasViewedViewOnce ? 'rgba(255,255,255,0.04)' : 'rgba(124,109,255,0.08)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white"
                                        style={{ background: 'var(--gradient-primary)', boxShadow: '0 6px 16px rgba(124,109,255,0.30)' }}>
                                        <EyeOff className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{viewOnceLabel}</p>
                                        <p className="text-xs opacity-50 mt-0.5">
                                            {isOwn
                                                ? (message.viewOnce?.views || []).length > 0 ? 'Opened' : 'Opens once per recipient'
                                                : hasViewedViewOnce ? 'Already viewed' : isOpeningViewOnce ? 'Opening…' : 'Tap to open'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* Image */}
                        {(message.type === 'image' || message.imageUrl) && !isViewOnceMedia && (
                            <div className="message-image mb-1.5 -mx-1 -mt-0.5" onClick={() => setShowImage(true)}>
                                <img src={message.fileUrl || message.imageUrl} alt="Shared" className="rounded-[16px] w-full" loading="lazy" />
                            </div>
                        )}

                        {/* Video */}
                        {(message.type === 'video' || message.videoUrl) && !isViewOnceMedia && (
                            <div className="mb-1.5 -mx-1 -mt-0.5 rounded-[16px] overflow-hidden">
                                <video src={message.fileUrl || message.videoUrl} className="w-full max-h-[280px] object-cover" controls preload="metadata" />
                            </div>
                        )}

                        {/* Audio */}
                        {message.type === 'audio' && (
                            <div className="mb-2 rounded-[16px] px-3 py-2.5" style={{ background: isOwn ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)', minWidth: '200px' }}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-end gap-[3px] h-5">
                                        {[...Array(8)].map((_, i) => <span key={i} className="waveform-bar" />)}
                                    </div>
                                    <span className="text-[11px] font-semibold opacity-60 uppercase tracking-widest ml-1">Voice</span>
                                </div>
                                <audio src={message.fileUrl} controls preload="metadata" className="w-full h-9" />
                            </div>
                        )}

                        {/* Poll */}
                        {message.type === 'poll' && message.poll?.question && (
                            <div className="mb-1.5 min-w-[220px] sm:min-w-[260px]">
                                <p className="text-sm font-bold mb-3 leading-snug">{message.poll.question}</p>
                                <div className="space-y-1.5">
                                    {pollOptions.map(option => {
                                        const votes = option.votes?.length || 0;
                                        const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                                        const selected = selectedOptionId === option.optionId;
                                        return (
                                            <button key={option.optionId} onClick={() => votePoll(message._id, option.optionId)}
                                                className={`w-full text-left relative overflow-hidden rounded-[14px] border px-3 py-2.5 transition-all ${selected ? 'border-primary-400/55' : 'border-white/10 hover:bg-white/5'}`}
                                                style={selected ? { background: 'rgba(124,109,255,0.12)' } : undefined}
                                            >
                                                <div className="absolute inset-y-0 left-0 rounded-[14px] opacity-50 transition-all duration-500"
                                                    style={{ width: `${pct}%`, background: selected ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.06)' }} />
                                                <div className="relative flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        {selected && <Check className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" />}
                                                        <span className="text-sm font-medium">{option.text}</span>
                                                    </div>
                                                    <span className="text-[11px] opacity-55 flex-shrink-0">{pct}%</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] opacity-40 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                            </div>
                        )}

                        {/* Text / editing */}
                        {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input value={editText} onChange={e => setEditText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleEdit()}
                                    className="flex-1 rounded-xl px-3 py-1.5 text-sm outline-none border border-primary-400/30"
                                    style={{ background: 'rgba(255,255,255,0.08)' }}
                                    autoFocus
                                />
                                <button onClick={handleEdit} className="text-xs font-semibold text-primary-300 hover:text-primary-200">Save</button>
                                <button onClick={() => setIsEditing(false)}><X className="w-3.5 h-3.5 opacity-50" /></button>
                            </div>
                        ) : (
                            message.text && (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap mt-0.5">{message.text}</p>
                            )
                        )}

                        {/* Timestamp row */}
                        <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? 'justify-end' : ''}`}>
                            {isStarred && <Star className="w-3 h-3 text-amber-300 fill-current" />}
                            {isPinnedMessage && <Pin className="w-3 h-3 text-primary-200/70" />}
                            {message.isEdited && <span className="text-[10px] italic opacity-35">edited</span>}
                            <span className={`text-[10px] ${isOwn ? 'opacity-55' : 'opacity-38'} tabular-nums`}>
                                {formatTime(message.createdAt)}
                            </span>
                            <StatusIcon />
                        </div>
                    </div>

                    {/* Reactions row */}
                    {message.reactions?.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <ReactionList reactions={message.reactions} onReact={handleReaction} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modals ── */}
            {showForwardModal && (
                <PremiumModal title="Forward message" subtitle="Choose a chat to forward to." onClose={() => setShowForwardModal(false)}>
                    <input type="text" value={forwardQuery} onChange={e => setForwardQuery(e.target.value)}
                        placeholder="Search chats…" className="input-glass py-2.5 text-sm mb-3" autoFocus />
                    <div className="max-h-72 overflow-y-auto space-y-2">
                        {forwardTargets.map(t => (
                            <button key={t.chatId} onClick={() => handleForward(t.chatId)} disabled={isForwarding}
                                className="w-full flex items-center gap-3 rounded-[18px] border border-white/8 bg-white/4 px-3 py-3 text-left hover:bg-white/7 transition-colors disabled:opacity-50">
                                <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                    {t.avatar ? <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                                        : <AvatarFallback name={t.name} variant={t.isGroup ? 'group' : 'person'} className="text-sm" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold truncate">{t.name}</p>
                                    <p className="text-xs opacity-42 truncate">{t.subtitle}</p>
                                </div>
                                <Forward className="w-4 h-4 opacity-35 flex-shrink-0" />
                            </button>
                        ))}
                        {forwardTargets.length === 0 && <EmptyState text="No other chats to forward to." />}
                    </div>
                </PremiumModal>
            )}

            {showBookmarkModal && (
                <PremiumModal title="Bookmark collections" subtitle="Organise messages or save a quick copy." onClose={() => setShowBookmarkModal(false)}>
                    <button onClick={async () => { await handleSaveToSaved(); setShowBookmarkModal(false); }}
                        className="w-full mb-3 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3 text-left hover:bg-white/7 transition-colors">
                        <p className="text-sm font-semibold">Quick save to Saved Messages</p>
                        <p className="text-xs opacity-42 mt-0.5">Keep a personal copy in your private cloud.</p>
                    </button>
                    <div className="rounded-[18px] border border-white/8 bg-white/4 p-3 mb-3">
                        <p className="text-[10px] uppercase tracking-widest opacity-38 mb-2">New collection</p>
                        <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                            placeholder="Name your collection…" className="input-glass py-2 text-sm mb-3" />
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                {bookmarkColorOptions.map(c => (
                                    <button key={c} onClick={() => setNewCollectionColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${newCollectionColor === c ? 'scale-110 border-white/70' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <button onClick={handleCreateCollection} disabled={!newCollectionName.trim()} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-40">Create</button>
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                        {isLoadingBookmarkCollections ? (
                            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" /></div>
                        ) : bookmarkCollections.length > 0 ? bookmarkCollections.map(col => {
                            const saved = isBookmarkedIn(col);
                            return (
                                <button key={col._id} onClick={() => toggleMessageInBookmarkCollection(col._id, message._id)}
                                    className={`w-full flex items-center justify-between gap-3 rounded-[18px] border px-3 py-3 text-left transition-colors ${saved ? 'border-primary-400/25 bg-primary-500/8' : 'border-white/8 bg-white/4 hover:bg-white/7'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color || '#7c6dff' }} />
                                        <p className="text-sm font-semibold truncate">{col.name}</p>
                                    </div>
                                    {saved ? <Check className="w-4 h-4 text-primary-300 flex-shrink-0" /> : <Bookmark className="w-4 h-4 opacity-32 flex-shrink-0" />}
                                </button>
                            );
                        }) : <EmptyState text="Create a collection to start organising." />}
                    </div>
                </PremiumModal>
            )}

            {showReminderModal && (
                <PremiumModal title="Remind me later" subtitle="Bring this message back exactly when you need it." onClose={() => setShowReminderModal(false)}>
                    <div className="space-y-2 mb-3">
                        {[
                            { label: 'In 1 hour', date: new Date(Date.now() + 3600000) },
                            { label: 'Tonight at 8 pm', date: (() => { const d = new Date(); d.setHours(20,0,0,0); if (d <= Date.now()) d.setDate(d.getDate()+1); return d; })() },
                            { label: 'Tomorrow morning', date: (() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0); return d; })() },
                            { label: 'Next week', date: (() => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(9,0,0,0); return d; })() },
                        ].map(p => (
                            <button key={p.label} onClick={() => handleCreateReminderAt(p.date.toISOString())} disabled={isCreatingReminder}
                                className="w-full rounded-[18px] border border-white/8 bg-white/4 px-4 py-3 text-left hover:bg-white/7 transition-colors disabled:opacity-50">
                                <p className="text-sm font-semibold">{p.label}</p>
                                <p className="text-xs opacity-42 mt-0.5">{p.date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                            </button>
                        ))}
                    </div>
                    <div className="rounded-[18px] border border-white/8 bg-white/4 p-3">
                        <label className="text-[10px] uppercase tracking-widest opacity-38 block mb-2">Custom time</label>
                        <input type="datetime-local" value={customReminderAt} min={formatDateTimeLocal(new Date(Date.now() + 60000))}
                            onChange={e => setCustomReminderAt(e.target.value)} className="input-glass py-2.5 text-sm mb-3" />
                        <button onClick={() => handleCreateReminderAt(new Date(customReminderAt).toISOString())}
                            disabled={isCreatingReminder || !customReminderAt}
                            className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
                            Set reminder
                        </button>
                    </div>
                </PremiumModal>
            )}

            {showImage && <ImagePreview imageUrl={message.fileUrl || message.imageUrl} onClose={() => setShowImage(false)} />}
            {viewOnceViewer && (
                <ViewOnceMediaViewer mediaUrl={viewOnceViewer.mediaUrl} type={viewOnceViewer.type}
                    durationSeconds={viewOnceViewer.durationSeconds} onClose={() => setViewOnceViewer(null)} />
            )}
            {showInfoModal && (
                <PremiumModal
                    title="Message Info"
                    subtitle="See when this message was sent, edited, and read."
                    onClose={() => {
                        setShowInfoModal(false);
                        setMessageInfo(null);
                    }}
                >
                    {isLoadingMessageInfo ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <MessageInfoCard message={message} messageInfo={messageInfo} />
                    )}
                </PremiumModal>
            )}

            {/* Long-press / right-click context bottom sheet */}
            {showContextSheet && (
                <MessageContextSheet
                    message={message}
                    isOwn={isOwn}
                    isStarred={isStarred}
                    isPinned={isPinnedMessage}
                    onClose={() => setShowContextSheet(false)}
                    onReact={handleReaction}
                    onReply={() => setReplyingTo(message)}
                    onStar={() => toggleStarMessage(message._id)}
                    onForward={() => setShowForwardModal(true)}
                    onPin={() => togglePinMessage(message._id)}
                    onBookmark={() => setShowBookmarkModal(true)}
                    onRemind={() => setShowReminderModal(true)}
                    onInfo={isOwn ? handleOpenInfo : null}
                    canEdit={canEditMessage}
                    onEdit={() => { setIsEditing(true); setEditText(message.text); setShowContextSheet(false); }}
                    onDeleteMe={() => handleDelete('me')}
                    onDeleteAll={() => handleDelete('everyone')}
                />
            )}
        </>
    );
}

// ── Sub-components ─────────────────────────────────
function ActionBtn({ icon, title, onClick, danger }) {
    return (
        <button onClick={onClick} title={title}
            className={`p-1.5 rounded-xl transition-all hover:scale-110 ${danger ? 'hover:bg-red-500/15 hover:text-red-300' : 'hover:bg-white/12'}`}>
            <span className="opacity-60 hover:opacity-90">{icon}</span>
        </button>
    );
}

function PremiumModal({ title, subtitle, onClose, children }) {
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-lg" />
            <div className="relative w-full max-w-md glass-panel rounded-[28px] border border-white/10 p-5 animate-slide-up shadow-[0_32px_80px_rgba(0,0,0,0.4)]"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-base">{title}</h3>
                        <p className="text-xs opacity-42 mt-0.5">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/8 flex-shrink-0">
                        <X className="w-4 h-4 opacity-55" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function EmptyState({ text }) {
    return (
        <div className="rounded-[18px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-center text-sm opacity-45">
            {text}
        </div>
    );
}

function MessageInfoCard({ message, messageInfo }) {
    const safeInfo = messageInfo || {};
    const readBy = Array.isArray(safeInfo.readBy) ? safeInfo.readBy : [];
    const pendingReaders = Array.isArray(safeInfo.pendingReaders) ? safeInfo.pendingReaders : [];

    return (
        <div className="space-y-4">
            <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-sm font-semibold mb-1">Message</p>
                <p className="text-sm opacity-70 break-words whitespace-pre-wrap">
                    {message?.text || getMessageSnippet(message)}
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <InfoBlock label="Sent" value={formatFullDateTime(safeInfo.createdAt || message?.createdAt)} />
                <InfoBlock
                    label="Edit Window"
                    value={safeInfo.canEdit && safeInfo.editableUntil
                        ? `Until ${formatFullDateTime(safeInfo.editableUntil)}`
                        : 'Ended'}
                />
                <InfoBlock
                    label="Edited"
                    value={safeInfo.isEdited
                        ? formatFullDateTime(safeInfo.editedAt || safeInfo.updatedAt)
                        : 'Not edited'}
                />
                <InfoBlock label="Status" value={safeInfo.status ? `${safeInfo.status}`.replace(/^./, (char) => char.toUpperCase()) : 'Sent'} />
            </div>

            <div className="rounded-[18px] border border-white/8 bg-white/4 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <p className="text-sm font-semibold">Read Receipts</p>
                        <p className="text-xs opacity-45 mt-0.5">See who has read this message and when.</p>
                    </div>
                    <span className="badge-pill !bg-primary-500/15 !text-primary-200">
                        {readBy.length} read
                    </span>
                </div>

                {readBy.length > 0 ? (
                    <div className="space-y-2">
                        {readBy.map((entry) => {
                            const person = entry.user || {};
                            return (
                                <div key={`${person._id || person.username || 'reader'}-${entry.seenAt || ''}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                        {person.avatar ? (
                                            <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <AvatarFallback name={person.name} className="text-sm" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{person.name || 'Reader'}</p>
                                        <p className="text-xs opacity-45 truncate">
                                            {person.username ? `@${person.username}` : 'Read receipt'}
                                        </p>
                                    </div>
                                    <p className="text-xs opacity-55 text-right flex-shrink-0">
                                        {formatFullDateTime(entry.seenAt)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState text="No one has read this message yet." />
                )}
            </div>

            {pendingReaders.length > 0 && (
                <div className="rounded-[18px] border border-white/8 bg-white/4 p-4">
                    <p className="text-sm font-semibold mb-3">Still Waiting On</p>
                    <div className="flex flex-wrap gap-2">
                        {pendingReaders.map((person) => (
                            <span key={person._id} className="badge-pill">
                                {person.name || person.username || 'Member'}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoBlock({ label, value }) {
    return (
        <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest opacity-38 mb-1.5">{label}</p>
            <p className="text-sm font-medium opacity-80">{value}</p>
        </div>
    );
}
