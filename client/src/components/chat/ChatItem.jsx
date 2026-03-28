// client/src/components/chat/ChatItem.jsx
// Individual chat item in the sidebar list

import { formatTime, formatMessagePreview } from '../../utils/formatters';
import { Pin, Image, Users, BellRing, Archive, Bookmark } from 'lucide-react';
import AvatarFallback from '../ui/AvatarFallback';
import { motion } from 'framer-motion';

export default function ChatItem({ chat, displayUser, isActive, isOnline, isTyping, unreadCount, isPinned, folderLabel = '', folderColor = '', onClick }) {
    const lastMsg = chat.lastMessage;
    const requestedById = chat.requestedBy?._id || chat.requestedBy;
    const isIncomingRequest = chat.requestStatus === 'pending' && requestedById === displayUser._id;
    const emptyChatLabel = displayUser.isSavedMessages ? 'Keep notes, links, and forwards here' : displayUser.isGroup ? 'Group created' : 'No messages yet';
    const isArchived = chat.archivedBy?.length > 0;

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`w-full flex items-center gap-3.5 p-3.5 rounded-[24px] transition-all duration-200 text-left group border
        ${isActive
                    ? 'bg-[rgba(111,107,255,0.12)] border-[rgba(111,107,255,0.32)] shadow-[0_12px_30px_rgba(111,107,255,0.14)]'
                    : 'hover:bg-white/5 border-transparent'
                }
      `}
        >
            {/* Avatar with online status */}
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/10">
                    {displayUser.avatar ? (
                        <img src={displayUser.avatar} alt={displayUser.name} className="w-full h-full object-cover" />
                    ) : (
                        <AvatarFallback
                            name={displayUser.name}
                            variant={displayUser.isGroup ? 'group' : 'person'}
                            icon={displayUser.isSavedMessages ? <Bookmark className="w-5 h-5" /> : displayUser.isGroup ? <Users className="w-6 h-6" /> : null}
                        />
                    )}
                </div>
                {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0f1320] shadow-[0_0_0_6px_rgba(16,185,129,0.14)]" />
                )}
            </div>

            {/* Chat info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <div className="min-w-0">
                        <h3 className={`text-sm font-semibold truncate ${unreadCount > 0 ? 'opacity-100' : 'opacity-85'}`}>
                            {displayUser.name}
                        </h3>
                        {displayUser.isSavedMessages && (
                            <p className="text-[11px] opacity-40 truncate tracking-[0.02em]">Personal cloud</p>
                        )}
                        {!displayUser.isGroup && displayUser.username && (
                            <p className="text-[11px] opacity-40 truncate tracking-[0.02em]">@{displayUser.username}</p>
                        )}
                        {folderLabel && (
                            <div className="mt-1 flex items-center gap-1.5">
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: folderColor || '#6f6bff' }}
                                />
                                <p className="text-[11px] opacity-50 truncate">{folderLabel}</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isArchived && <Archive className="w-3.5 h-3.5 opacity-40" />}
                        {isPinned && <Pin className="w-3.5 h-3.5 text-primary-300" />}
                        {lastMsg && (
                            <span className="text-[11px] opacity-40 tabular-nums">
                                {formatTime(lastMsg.createdAt || chat.updatedAt)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs truncate flex items-center gap-1.5 ${isTyping ? 'text-primary-300' : 'opacity-50'}`}>
                        {isTyping ? (
                            <span className="flex items-center gap-1">
                                <BellRing className="w-3 h-3" />
                                typing
                                <span className="flex gap-0.5">
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                    <span className="typing-dot w-1 h-1 rounded-full bg-primary-400 inline-block" />
                                </span>
                            </span>
                        ) : chat.requestStatus === 'pending' ? (
                            isIncomingRequest ? 'Message request' : 'Waiting for acceptance'
                        ) : lastMsg ? (
                            lastMsg.forwardedFrom?.senderName ? (
                                <span>Forwarded: {formatMessagePreview(lastMsg.text || lastMsg.forwardedFrom.senderName)}</span>
                            ) : lastMsg.viewOnce?.enabled ? (
                                <span>{lastMsg.type === 'video' ? 'View once video' : 'View once photo'}</span>
                            ) : lastMsg.type === 'poll' ? (
                                <span>Poll: {lastMsg.poll?.question || 'New poll'}</span>
                            ) : (lastMsg.type === 'image' || lastMsg.imageUrl) && !lastMsg.text ? (
                                <span className="flex items-center gap-1">
                                    <Image className="w-3 h-3" /> Photo
                                </span>
                            ) : lastMsg.type === 'audio' && !lastMsg.text ? (
                                <span>Voice message</span>
                            ) : lastMsg.type === 'video' && !lastMsg.text ? (
                                <span>Video</span>
                            ) : lastMsg.type === 'document' && !lastMsg.text ? (
                                <span>Document</span>
                            ) : lastMsg.isDeleted ? (
                                <span className="italic">Message deleted</span>
                            ) : (
                                formatMessagePreview(lastMsg.text)
                            )
                        ) : (
                            emptyChatLabel
                        )}
                    </p>

                    {unreadCount > 0 && (
                        <span className="ml-2 min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center flex-shrink-0 pulse-badge"
                            style={{ background: 'var(--gradient-primary)' }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </motion.button>
    );
}
