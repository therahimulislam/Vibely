// client/src/components/chat/ChatItem.jsx
// Premium chat list item — Aurora Dark design

import { formatTime, formatMessagePreview } from '../../utils/formatters';
import { Pin, Archive, Bookmark, Users, Camera, Mic, FileText, Video, BarChart3, Forward, Check, CheckCheck } from 'lucide-react';
import AvatarFallback from '../ui/AvatarFallback';
import { motion } from 'framer-motion';

const MessageTypeIcon = ({ lastMsg }) => {
    if (!lastMsg) return null;
    if (lastMsg.viewOnce?.enabled) return <Camera className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.type === 'image' || lastMsg.imageUrl) return <Camera className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.type === 'video' || lastMsg.videoUrl) return <Video className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.type === 'audio') return <Mic className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.type === 'document') return <FileText className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.type === 'poll') return <BarChart3 className="w-3 h-3 flex-shrink-0 opacity-70" />;
    if (lastMsg.forwardedFrom?.senderName) return <Forward className="w-3 h-3 flex-shrink-0 opacity-70" />;
    return null;
};

const MessageStatusIcon = ({ msg, isOwn }) => {
    if (!isOwn || !msg) return null;
    if (msg.status === 'seen') return <CheckCheck className="w-3 h-3 text-cyan-400 flex-shrink-0" />;
    if (msg.status === 'delivered') return <CheckCheck className="w-3 h-3 opacity-40 flex-shrink-0" />;
    return <Check className="w-3 h-3 opacity-40 flex-shrink-0" />;
};

export default function ChatItem({
    chat,
    displayUser,
    isActive,
    isOnline,
    isTyping,
    unreadCount,
    isPinned,
    folderLabel = '',
    folderColor = '',
    draftText = '',
    currentUserId,
    onClick,
}) {
    const lastMsg = chat.lastMessage;
    const requestedById = chat.requestedBy?._id || chat.requestedBy;
    const isIncomingRequest = chat.requestStatus === 'pending' && requestedById === displayUser._id;
    const emptyChatLabel = displayUser.isSavedMessages
        ? 'Your private notes & forwards'
        : displayUser.isGroup
            ? 'Group created'
            : 'Say hello 👋';
    const isArchived = chat.archivedBy?.length > 0;
    const hasDraft = !!draftText.trim() && chat.requestStatus !== 'pending';
    const isOwnLastMsg = lastMsg && (
        (lastMsg.senderId?._id || lastMsg.senderId) === currentUserId
    );

    const getPreviewText = () => {
        if (isTyping) return null;
        if (hasDraft) return draftText;
        if (!lastMsg) return emptyChatLabel;
        if (lastMsg.isDeleted) return 'Message deleted';
        if (lastMsg.viewOnce?.enabled) return lastMsg.type === 'video' ? 'View once video' : 'View once photo';
        if (lastMsg.type === 'poll') return lastMsg.poll?.question || 'New poll';
        if ((lastMsg.type === 'image' || lastMsg.imageUrl) && !lastMsg.text) return 'Photo';
        if (lastMsg.type === 'audio' && !lastMsg.text) return 'Voice message';
        if (lastMsg.type === 'video' && !lastMsg.text) return 'Video';
        if (lastMsg.type === 'document' && !lastMsg.text) return lastMsg.fileName || 'Document';
        if (lastMsg.forwardedFrom?.senderName) return lastMsg.text || `Forwarded from ${lastMsg.forwardedFrom.senderName}`;
        return formatMessagePreview(lastMsg.text) || emptyChatLabel;
    };

    const previewText = getPreviewText();

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`w-full flex items-center gap-3 p-3 rounded-[20px] transition-all duration-200 text-left relative border ${
                isActive
                    ? 'border-[rgba(124,109,255,0.28)] shadow-[0_8px_28px_rgba(124,109,255,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent hover:border-[rgba(255,255,255,0.05)]'
            }`}
            style={isActive ? {
                background: 'linear-gradient(135deg, rgba(124,109,255,0.14) 0%, rgba(157,78,221,0.08) 100%)',
            } : undefined}
        >
            {/* Active left accent bar */}
            {isActive && (
                <div
                    className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full"
                    style={{ background: 'var(--gradient-primary)' }}
                />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full overflow-hidden ${
                    isOnline ? 'ring-[2.5px] ring-emerald-400/70' : 'ring-1 ring-white/10'
                }`}
                    style={isOnline ? { boxShadow: '0 0 0 4px rgba(34,197,94,0.12)' } : undefined}
                >
                    {displayUser.avatar ? (
                        <img src={displayUser.avatar} alt={displayUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <AvatarFallback
                            name={displayUser.name}
                            variant={displayUser.isSavedMessages ? 'saved' : displayUser.isGroup ? 'group' : 'person'}
                            icon={displayUser.isSavedMessages ? <Bookmark className="w-5 h-5" /> : displayUser.isGroup ? <Users className="w-5 h-5" /> : null}
                        />
                    )}
                </div>
                {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 animate-pulse-online"
                        style={{ borderColor: 'var(--color-bg, rgba(10,13,24,1))' }}
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Top row: name + timestamp */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`text-sm font-semibold truncate leading-tight ${
                            unreadCount > 0 ? 'opacity-100' : 'opacity-88'
                        }`}>
                            {displayUser.name}
                        </h3>
                        {isArchived && <Archive className="w-3 h-3 opacity-35 flex-shrink-0" />}
                        {isPinned && <Pin className="w-3 h-3 text-primary-300/70 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isOwnLastMsg && <MessageStatusIcon msg={lastMsg} isOwn={true} />}
                        {lastMsg && (
                            <span className={`text-[11px] tabular-nums ${
                                unreadCount > 0 ? 'text-primary-300 font-semibold' : 'opacity-38'
                            }`}>
                                {formatTime(lastMsg.createdAt || chat.updatedAt)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Bottom row: preview + unread */}
                <div className="flex items-center justify-between gap-2">
                    <div className={`text-xs truncate flex items-center gap-1 min-w-0 ${
                        isTyping
                            ? 'text-primary-300'
                            : hasDraft
                                ? 'text-amber-300'
                                : 'opacity-48'
                    }`}>
                        {isTyping ? (
                            <span className="flex items-center gap-1.5">
                                <span className="flex items-center gap-0.5 mt-0.5">
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                </span>
                                <span>typing</span>
                            </span>
                        ) : hasDraft ? (
                            <span className="flex items-center gap-1 truncate">
                                <span className="font-semibold flex-shrink-0">Draft:</span>
                                <span className="truncate opacity-80">{previewText}</span>
                            </span>
                        ) : chat.requestStatus === 'pending' ? (
                            <span className="truncate">{isIncomingRequest ? '📩 Message request' : 'Awaiting acceptance…'}</span>
                        ) : (
                            <span className="flex items-center gap-1 truncate">
                                {previewText && <MessageTypeIcon lastMsg={lastMsg} />}
                                <span className="truncate">{previewText}</span>
                            </span>
                        )}
                    </div>

                    {/* Unread badge */}
                    {unreadCount > 0 && (
                        <span
                            className="ml-1 min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 pulse-badge"
                            style={{ background: 'var(--gradient-primary)' }}
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>

                {/* Folder label */}
                {folderLabel && (
                    <div className="mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: folderColor || '#7c6dff' }} />
                        <p className="text-[10px] opacity-40 truncate">{folderLabel}</p>
                    </div>
                )}
            </div>
        </motion.button>
    );
}
