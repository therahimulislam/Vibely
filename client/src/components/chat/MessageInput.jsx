// client/src/components/chat/MessageInput.jsx
// Message input with emoji picker, image upload, and floating send button

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, Image, Video, X, Paperclip, FileText } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function MessageInput({ chatId, recipientId }) {
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaType, setMediaType] = useState('text'); // 'image', 'video', 'document'
    const [isSending, setIsSending] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttach, setShowAttach] = useState(false);
    const [isDocument, setIsDocument] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const { sendMessage, emitTyping, emitStopTyping } = useSocket();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, [chatId]);

    // Handle typing indicator
    const handleTyping = useCallback(() => {
        emitTyping(chatId, recipientId);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            emitStopTyping(chatId, recipientId);
        }, 2000);
    }, [chatId, recipientId]);

    const handleMediaSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            toast.error('File must be under 50MB');
            return;
        }

        setMedia(file);

        if (isDocument) {
            setMediaType('document');
            setMediaPreview(file.name);
        } else {
            // Gallery mode (auto-detect)
            if (file.type.startsWith('image/')) {
                setMediaType('image');
                setMediaPreview(URL.createObjectURL(file));
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
                setMediaPreview(URL.createObjectURL(file));
            } else {
                // Fallback for non-image/video in gallery mode (should generally be filtered out by accept, but safety)
                setMediaType('document');
                setMediaPreview(file.name);
            }
        }
        setShowAttach(false);
    };

    const handleSend = async () => {
        if ((!text.trim() && !media) || isSending) return;

        setIsSending(true);
        emitStopTyping(chatId, recipientId);

        try {
            if (media) {
                // Upload via REST API (for file uploads)
                const formData = new FormData();
                formData.append('chatId', chatId);
                formData.append('text', text.trim());
                formData.append('media', media);
                formData.append('type', mediaType === 'document' ? 'document' : 'auto');

                await api.post('/messages/send', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(progress);
                    },
                });

                // Refetch messages to get the uploaded one
                const { data } = await api.get(`/messages/${chatId}?page=1&limit=1`);
                if (data.messages.length > 0) {
                    // The socket handler will pick up the new message
                }
            } else {
                // Send via socket for instant delivery
                sendMessage({
                    chatId,
                    text: text.trim(),
                    tempId: Date.now().toString(),
                });
            }

            setText('');
            setMedia(null);
            setMediaPreview(null);
            setUploadProgress(0);
            inputRef.current?.focus();
        } catch (error) {
            toast.error('Failed to send message');
            console.error('Send error:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick emoji insert
    const quickEmojis = ['😊', '😂', '❤️', '👍', '🔥', '😮', '🎉', '🥺'];

    return (
        <div className="px-4 py-3 flex-shrink-0 border-t border-white/5">
            {mediaPreview && (
                <div className="mb-3 relative inline-block animate-slide-up">
                    {mediaType === 'video' ? (
                        <video
                            src={mediaPreview}
                            className="h-32 rounded-xl object-cover border border-white/10"
                            controls={false}
                            autoPlay
                            muted
                            loop
                        />
                    ) : mediaType === 'document' ? (
                        <div className="h-16 px-4 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3 min-w-[200px]">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <FileText className="w-6 h-6 text-primary-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-white">{media.name}</p>
                                <p className="text-xs text-white/50">{(media.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                    ) : (
                        <img
                            src={mediaPreview}
                            alt="Preview"
                            className="h-32 rounded-xl object-cover border border-white/10"
                        />
                    )}
                    <button
                        onClick={() => { setMedia(null); setMediaPreview(null); }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center z-10"
                    >
                        <X className="w-3 h-3 text-white" />
                    </button>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="absolute bottom-2 left-2 right-2">
                            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%`, background: 'var(--gradient-primary)' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quick emoji bar */}
            {showEmoji && (
                <div className="mb-2 flex gap-1 animate-slide-up">
                    {quickEmojis.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => { setText((t) => t + emoji); inputRef.current?.focus(); }}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-transform hover:scale-125 text-xl"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
                {/* Emoji toggle */}
                <button
                    onClick={() => setShowEmoji(!showEmoji)}
                    className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${showEmoji ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-white/5'}`}
                >
                    <Smile className="w-5 h-5 opacity-50" />
                </button>

                {/* Attach Menu */}
                <div className="relative">
                    {showAttach && (
                        <div className="absolute bottom-full mb-2 left-0 glass-card p-2 min-w-[140px] flex flex-col gap-1 z-20 animate-slide-up">
                            <button
                                onClick={() => {
                                    setIsDocument(false);
                                    if (fileInputRef.current) fileInputRef.current.accept = "image/*,video/*";
                                    fileInputRef.current?.click();
                                }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors text-left"
                            >
                                <Image className="w-4 h-4 text-purple-400" />
                                <span>Gallery</span>
                            </button>
                            <button
                                onClick={() => {
                                    setIsDocument(true);
                                    if (fileInputRef.current) fileInputRef.current.accept = "*";
                                    fileInputRef.current?.click();
                                }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors text-left"
                            >
                                <FileText className="w-4 h-4 text-blue-400" />
                                <span>Document</span>
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setShowAttach(!showAttach)}
                        className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${showAttach ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-white/5'}`}
                        title="Attach file"
                    >
                        <Paperclip className="w-5 h-5 opacity-50" />
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple={false}
                    onChange={handleMediaSelect}
                    className="hidden"
                />

                {/* Text input */}
                <div className="flex-1">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => { setText(e.target.value); handleTyping(); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        rows={1}
                        className="input-glass py-2.5 text-sm resize-none max-h-32 min-h-[42px]"
                        style={{ height: 'auto', overflow: text.split('\n').length > 3 ? 'auto' : 'hidden' }}
                    />
                </div>

                {/* Send button (floating) */}
                <button
                    onClick={handleSend}
                    disabled={isSending || (!text.trim() && !media)}
                    className="p-3 rounded-xl text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 hover:scale-105 active:scale-95"
                    style={{
                        background: text.trim() || media ? 'var(--gradient-primary)' : 'rgba(124, 92, 252, 0.2)',
                        boxShadow: text.trim() || media ? '0 4px 15px rgba(124, 92, 252, 0.35)' : 'none',
                    }}
                >
                    {isSending ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </div>
        </div>
    );
}
