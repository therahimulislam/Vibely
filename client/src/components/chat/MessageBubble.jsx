// client/src/components/chat/MessageBubble.jsx
// Individual message bubble with gradient, status, reactions, and context menu

import { useState, useRef } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Pin, Trash2, Search, Play, FileText, Download, SmilePlus, Edit3, Check, CheckCheck, X } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import { formatTime } from '../../utils/formatters';
import { EMOJI_LIST } from '../../utils/constants';
import ImagePreview from './ImagePreview';

export default function MessageBubble({ message, isOwn, otherUser, showAvatar }) {
    const [showReactions, setShowReactions] = useState(false);
    const [showContext, setShowContext] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.text);
    const [showImage, setShowImage] = useState(false);
    const { emitReaction, emitDeleteMessage, emitEditMessage } = useSocket();
    const { user } = useAuthStore();
    const { votePoll } = useChatStore();

    if (message.isDeleted) {
        return (
            <div className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-xl text-xs italic opacity-40 ${isOwn ? 'bubble-sent opacity-50' : 'bubble-received opacity-50'}`}>
                    🚫 This message was deleted
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
        setShowContext(false);
    };

    const handleEdit = () => {
        if (editText.trim() && editText !== message.text) {
            emitEditMessage(message._id, editText, otherUser?._id);
        }
        setIsEditing(false);
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

    const sender = message.senderId || {};
    const pollOptions = message.poll?.options || [];
    const totalVotes = pollOptions.reduce((sum, option) => sum + (option.votes?.length || 0), 0);
    const selectedOptionId = pollOptions.find((option) =>
        option.votes?.some((vote) => (vote?._id || vote)?.toString?.() === user?._id)
    )?.optionId;

    return (
        <>
            <div
                className={`flex mb-1.5 ${isOwn ? 'justify-end' : 'justify-start'} group animate-slide-up`}
                onContextMenu={(e) => { e.preventDefault(); if (isOwn) setShowContext(!showContext); }}
            >
                {/* Avatar for received messages */}
                {!isOwn && showAvatar && (
                    <div className="w-7 h-7 rounded-full overflow-hidden mr-2 mt-auto flex-shrink-0" title={sender.name}>
                        {sender.avatar ? (
                            <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ background: 'var(--gradient-accent)' }}>
                                {sender.name?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                )}
                {!isOwn && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}

                <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] relative min-w-0">
                    {/* Context actions (hover) */}
                    <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
                        <button
                            onClick={() => setShowReactions(!showReactions)}
                            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <SmilePlus className="w-3.5 h-3.5 opacity-40" />
                        </button>
                        {isOwn && (
                            <>
                                {message.type === 'text' && (
                                    <button
                                        onClick={() => { setIsEditing(true); setEditText(message.text); }}
                                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                    >
                                        <Edit3 className="w-3.5 h-3.5 opacity-40" />
                                    </button>
                                )}
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

                    {/* Emoji reactions popup */}
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

                    {/* Message content */}
                    <div className={`${isOwn ? 'bubble-sent' : 'bubble-received'} px-3.5 py-2`}>
                        {/* Document */}
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

                        {/* Image */}
                        {(message.type === 'image' || message.imageUrl) && (
                            <div
                                className="message-image mb-1.5 -mx-1 -mt-0.5"
                                onClick={() => setShowImage(true)}
                            >
                                <img
                                    src={message.fileUrl || message.imageUrl}
                                    alt="Shared image"
                                    className="rounded-lg w-full"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Video */}
                        {(message.type === 'video' || message.videoUrl) && (
                            <div className="message-video mb-1.5 -mx-1 -mt-0.5 relative group/video">
                                <video
                                    src={message.fileUrl || message.videoUrl}
                                    className="rounded-lg w-full max-h-[300px] object-cover"
                                    controls
                                    preload="metadata"
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

                        {/* Text or edit mode */}
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

                        {/* Time + status */}
                        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            {message.isEdited && (
                                <span className="text-[10px] opacity-40 italic">edited</span>
                            )}
                            <span className={`text-[10px] ${isOwn ? 'opacity-60' : 'opacity-40'}`}>
                                {formatTime(message.createdAt)}
                            </span>
                            {statusIcon()}
                        </div>
                    </div>

                    {/* Reactions display */}
                    {message.reactions?.length > 0 && (
                        <div className={`flex gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {message.reactions.map((r, i) => (
                                <span
                                    key={i}
                                    onClick={() => handleReaction(r.emoji)}
                                    className="text-sm px-1.5 py-0.5 glass-card rounded-full cursor-pointer hover:scale-110 transition-transform"
                                    title={r.userId?.name || 'Someone'}
                                >
                                    {r.emoji}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Image lightbox */}
            {showImage && (
                <ImagePreview
                    imageUrl={message.fileUrl || message.imageUrl}
                    onClose={() => setShowImage(false)}
                />
            )}
        </>
    );
}
