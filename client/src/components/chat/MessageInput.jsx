// client/src/components/chat/MessageInput.jsx
// Message input with emoji picker, image upload, and floating send button

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile, Image, X, Paperclip, FileText, BarChart3, Plus, Minus, Mic, Sparkles, Reply, CalendarDays, Clock3, Trash2, Edit3, EyeOff } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import useChatStore from '../../store/useChatStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function MessageInput({ chatId, recipientId, disabled = false, isGroup = false }) {
    const formatDateTimeLocal = (date) => {
        const pad = (value) => `${value}`.padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const getDefaultScheduleTime = () => {
        const nextHour = new Date(Date.now() + 60 * 60 * 1000);
        nextHour.setSeconds(0, 0);
        return formatDateTimeLocal(nextHour);
    };
    const [text, setText] = useState('');
    const [media, setMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [mediaType, setMediaType] = useState('text');
    const [isSending, setIsSending] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttach, setShowAttach] = useState(false);
    const [isDocument, setIsDocument] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showPollComposer, setShowPollComposer] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [showScheduleComposer, setShowScheduleComposer] = useState(false);
    const [scheduledFor, setScheduledFor] = useState(getDefaultScheduleTime());
    const [editingScheduledMessage, setEditingScheduledMessage] = useState(null);
    const [scheduledEditText, setScheduledEditText] = useState('');
    const [viewOnceEnabled, setViewOnceEnabled] = useState(false);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordingStreamRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const { sendMessage, emitTyping, emitStopTyping } = useSocket();
    const {
        createPoll,
        createScheduledMessage,
        deleteScheduledMessage,
        updateScheduledMessage,
        scheduledMessages,
        isLoadingScheduledMessages,
        addMessage,
        replyingTo,
        clearReplyingTo,
    } = useChatStore();

    const getReplyPreview = (message) => {
        if (!message) return '';
        if (message.isDeleted) return 'Deleted message';
        if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
        if (message.type === 'poll') return message.poll?.question || 'Poll';
        if (message.type === 'image') return message.text || 'Photo';
        if (message.type === 'video') return message.text || 'Video';
        if (message.type === 'audio') return 'Voice message';
        if (message.type === 'document') return message.fileName || message.text || 'Document';
        return message.text || 'Message';
    };

    const formatScheduledDate = (value) =>
        new Date(value).toLocaleString([], {
            day: '2-digit',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
        });

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, [chatId]);

    useEffect(() => {
        clearReplyingTo();
        setShowScheduleComposer(false);
        setScheduledFor(getDefaultScheduleTime());
        setEditingScheduledMessage(null);
        setScheduledEditText('');
        setViewOnceEnabled(false);
    }, [chatId, clearReplyingTo]);

    useEffect(() => {
        if (!media || !['image', 'video'].includes(mediaType)) {
            setViewOnceEnabled(false);
        }
    }, [media, mediaType]);

    useEffect(() => () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
        }
        if (mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current?.stop();
        }
        recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    }, []);

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

    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const getSupportedAudioMimeType = () => {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/ogg;codecs=opus',
            'audio/webm',
            'audio/mp4',
        ];

        return candidates.find((candidate) => window.MediaRecorder?.isTypeSupported?.(candidate)) || '';
    };

    const resetRecordingState = () => {
        setIsRecording(false);
        setRecordingSeconds(0);
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
    };

    const startVoiceRecording = async () => {
        if (disabled || isRecording || isSending) return;
        if (media) {
            toast.error('Send or remove the current attachment first');
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            toast.error('Voice recording is not supported on this browser');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedAudioMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

            recordingStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            recordingChunksRef.current = [];
            setIsRecording(true);
            setRecordingSeconds(0);

            recorder.ondataavailable = (event) => {
                if (event.data?.size) {
                    recordingChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const fallbackMimeType = recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(recordingChunksRef.current, { type: fallbackMimeType });
                const extension = fallbackMimeType.includes('ogg') ? 'ogg' : fallbackMimeType.includes('mp4') ? 'm4a' : 'webm';
                const voiceFile = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: fallbackMimeType });

                setMedia(voiceFile);
                setMediaType('audio');
                setMediaPreview(URL.createObjectURL(voiceFile));
                resetRecordingState();
            };

            recorder.start();
            recordingTimerRef.current = setInterval(() => {
                setRecordingSeconds((value) => value + 1);
            }, 1000);
        } catch (error) {
            console.error('Voice recording error:', error);
            toast.error('Microphone permission is required for voice messages');
            resetRecordingState();
        }
    };

    const stopVoiceRecording = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            resetRecordingState();
            return;
        }

        mediaRecorderRef.current.stop();
    };

    const handleSend = async () => {
        if ((!text.trim() && !media) || isSending || disabled) return;

        setIsSending(true);
        emitStopTyping(chatId, recipientId);

        try {
            if (media) {
                // Upload via REST API (for file uploads)
                const formData = new FormData();
                formData.append('chatId', chatId);
                formData.append('text', text.trim());
                formData.append('media', media);
                formData.append('type', mediaType === 'document' ? 'document' : mediaType === 'audio' ? 'audio' : 'auto');
                if (viewOnceEnabled) {
                    formData.append('viewOnce', 'true');
                    formData.append('viewOnceDuration', '10');
                }
                if (replyingTo?._id) {
                    formData.append('replyTo', replyingTo._id);
                }

                const { data } = await api.post('/messages/send', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(progress);
                    },
                });
                addMessage(data.message);
            } else {
                // Send via socket for instant delivery
                sendMessage({
                    chatId,
                    text: text.trim(),
                    replyTo: replyingTo?._id || null,
                    tempId: Date.now().toString(),
                });
            }

            setText('');
            setMedia(null);
            setMediaPreview(null);
            setMediaType('text');
            setViewOnceEnabled(false);
            setUploadProgress(0);
            clearReplyingTo();
            inputRef.current?.focus();
        } catch (error) {
            toast.error('Failed to send message');
            console.error('Send error:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleScheduleMessage = async () => {
        if ((!text.trim() && !media) || isSending || disabled) return;

        setIsSending(true);
        emitStopTyping(chatId, recipientId);

        try {
            const formData = new FormData();
            formData.append('chatId', chatId);
            formData.append('text', text.trim());
            formData.append('scheduledFor', scheduledFor);
            if (media) {
                formData.append('media', media);
                formData.append('type', mediaType === 'document' ? 'document' : mediaType === 'audio' ? 'audio' : 'auto');
                if (viewOnceEnabled) {
                    formData.append('viewOnce', 'true');
                    formData.append('viewOnceDuration', '10');
                }
            }
            if (replyingTo?._id) {
                formData.append('replyTo', replyingTo._id);
            }

            await createScheduledMessage(formData);
            setText('');
            setMedia(null);
            setMediaPreview(null);
            setMediaType('text');
            setViewOnceEnabled(false);
            setUploadProgress(0);
            setShowScheduleComposer(false);
            setScheduledFor(getDefaultScheduleTime());
            clearReplyingTo();
            inputRef.current?.focus();
        } catch (error) {
            console.error('Schedule error:', error);
        } finally {
            setIsSending(false);
        }
    };

    const openScheduledEditor = (message) => {
        if (!message) return;
        setEditingScheduledMessage(message);
        setScheduledEditText(message.text || '');
        setScheduledFor(formatDateTimeLocal(new Date(message.scheduledFor)));
        setShowScheduleComposer(false);
    };

    const closeScheduledPanel = () => {
        setShowScheduleComposer(false);
        setEditingScheduledMessage(null);
        setScheduledEditText('');
        setScheduledFor(getDefaultScheduleTime());
    };

    const handleUpdateScheduledMessage = async () => {
        if (!editingScheduledMessage?._id) return;

        setIsSending(true);
        try {
            await updateScheduledMessage(editingScheduledMessage._id, {
                text: scheduledEditText,
                scheduledFor,
            });
            closeScheduledPanel();
        } catch (error) {
            console.error('Update scheduled message error:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleCreatePoll = async () => {
        const normalizedOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
        if (!pollQuestion.trim()) {
            toast.error('Add a poll question');
            return;
        }

        if (normalizedOptions.length < 2) {
            toast.error('Add at least two poll options');
            return;
        }

        try {
            await createPoll(chatId, pollQuestion.trim(), normalizedOptions);
            setShowPollComposer(false);
            setPollQuestion('');
            setPollOptions(['', '']);
            setShowAttach(false);
        } catch (error) {
            console.error('Create poll error:', error);
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
    const handleUnavailableFeature = (label) => toast(label);

    return (
        <div className="px-3 sm:px-5 py-3 sm:py-4 flex-shrink-0 border-t border-white/5">
            {(isLoadingScheduledMessages || scheduledMessages.length > 0) && (
                <div className="mb-3 glass-card rounded-2xl px-4 py-3 animate-slide-up">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <CalendarDays className="w-4 h-4 text-primary-300" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">Scheduled messages</p>
                                <p className="text-xs opacity-50">
                                    {isLoadingScheduledMessages
                                        ? 'Loading your upcoming queue...'
                                        : `${scheduledMessages.length} waiting to be delivered`}
                                </p>
                            </div>
                        </div>
                        {!showScheduleComposer && (
                            <button
                                onClick={() => setShowScheduleComposer(true)}
                                className="badge-pill hover:opacity-100 opacity-80 transition-opacity"
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                                Schedule
                            </button>
                        )}
                    </div>

                    {!isLoadingScheduledMessages && scheduledMessages.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {scheduledMessages.slice(0, 4).map((message) => (
                                <div
                                    key={message._id}
                                    className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 flex items-start justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock3 className="w-3.5 h-3.5 text-primary-300" />
                                            <span className="text-xs font-medium text-primary-200">
                                                {formatScheduledDate(message.scheduledFor)}
                                            </span>
                                        </div>
                                        <p className="text-sm opacity-80 truncate">
                                            {getReplyPreview(message)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openScheduledEditor(message)}
                                        className="p-2 rounded-xl hover:bg-white/5 text-primary-200 flex-shrink-0"
                                        title="Edit scheduled message"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteScheduledMessage(message._id)}
                                        className="p-2 rounded-xl hover:bg-red-500/10 text-red-300 flex-shrink-0"
                                        title="Remove scheduled message"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {replyingTo && (
                <div className="mb-3 glass-card rounded-2xl px-4 py-3 animate-slide-up">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Reply className="w-4 h-4 text-primary-300" />
                                <p className="text-xs font-semibold text-primary-300">
                                    Replying to {replyingTo.senderId?.name || 'message'}
                                </p>
                            </div>
                            <p className="text-sm opacity-70 truncate">
                                {getReplyPreview(replyingTo)}
                            </p>
                        </div>
                        <button
                            onClick={clearReplyingTo}
                            className="p-1.5 rounded-lg hover:bg-white/5 flex-shrink-0"
                        >
                            <X className="w-4 h-4 opacity-50" />
                        </button>
                    </div>
                </div>
            )}

            {(showScheduleComposer || editingScheduledMessage) && (
                <div className="mb-3 glass-card p-4 rounded-2xl animate-slide-up border border-primary-400/15">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <h4 className="text-sm font-semibold">
                                {editingScheduledMessage ? 'Edit scheduled message' : 'Schedule message'}
                            </h4>
                            <p className="text-xs opacity-45">
                                {editingScheduledMessage
                                    ? 'Adjust the caption or delivery time without rebuilding the whole draft.'
                                    : 'Write now, deliver later with a calm, Telegram-style send later flow.'}
                            </p>
                        </div>
                        <button
                            onClick={closeScheduledPanel}
                            className="p-2 rounded-lg hover:bg-white/5"
                        >
                            <X className="w-4 h-4 opacity-60" />
                        </button>
                    </div>

                    {editingScheduledMessage ? (
                        <div className="mb-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Scheduled draft</p>
                            <textarea
                                value={scheduledEditText}
                                onChange={(event) => setScheduledEditText(event.target.value)}
                                placeholder={editingScheduledMessage.fileUrl ? 'Add an optional caption...' : 'Message text'}
                                className="input-glass py-2.5 text-sm resize-none min-h-[88px]"
                            />
                            {editingScheduledMessage.fileUrl && (
                                <p className="text-xs opacity-45 mt-2">
                                    Attached {editingScheduledMessage.type === 'document' ? 'document' : editingScheduledMessage.type} will be sent with this draft.
                                </p>
                            )}
                        </div>
                    ) : null}

                    <label className="text-xs uppercase tracking-[0.18em] opacity-45 block mb-2">
                        Deliver on
                    </label>
                    <input
                        type="datetime-local"
                        value={scheduledFor}
                        min={formatDateTimeLocal(new Date(Date.now() + 60000))}
                        onChange={(event) => setScheduledFor(event.target.value)}
                        className="input-glass py-2.5 text-sm"
                    />

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs opacity-50">
                            {editingScheduledMessage
                                ? 'Your queued message will keep its media and update instantly.'
                                : text.trim() || media
                                    ? 'This draft will be removed from the composer after scheduling.'
                                    : 'Add text or media, then choose when to deliver it.'}
                        </p>
                        <button
                            onClick={editingScheduledMessage ? handleUpdateScheduledMessage : handleScheduleMessage}
                            disabled={disabled || isSending || isRecording || (editingScheduledMessage ? (!scheduledEditText.trim() && !editingScheduledMessage.fileUrl) : (!text.trim() && !media))}
                            className="btn-primary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {editingScheduledMessage ? 'Save changes' : 'Schedule it'}
                        </button>
                    </div>
                </div>
            )}

            {showPollComposer && (
                <div className="mb-3 glass-card p-4 rounded-2xl animate-slide-up">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <h4 className="text-sm font-semibold">Create poll</h4>
                            <p className="text-xs opacity-45">Group members can vote and change their choice later.</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowPollComposer(false);
                                setPollQuestion('');
                                setPollOptions(['', '']);
                            }}
                            className="p-2 rounded-lg hover:bg-white/5"
                        >
                            <X className="w-4 h-4 opacity-60" />
                        </button>
                    </div>

                    <input
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="Poll question"
                        className="input-glass py-2 text-sm mb-3"
                    />

                    <div className="space-y-2">
                        {pollOptions.map((option, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    value={option}
                                    onChange={(e) => {
                                        const next = [...pollOptions];
                                        next[index] = e.target.value;
                                        setPollOptions(next);
                                    }}
                                    placeholder={`Option ${index + 1}`}
                                    className="input-glass py-2 text-sm"
                                />
                                {pollOptions.length > 2 && (
                                    <button
                                        onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-300"
                                        title="Remove option"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <button
                            onClick={() => {
                                if (pollOptions.length < 6) {
                                    setPollOptions((current) => [...current, '']);
                                }
                            }}
                            className="btn-glass px-3 py-2 text-sm"
                        >
                            <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add option</span>
                        </button>
                        <button
                            onClick={handleCreatePoll}
                            className="btn-primary px-4 py-2 text-sm"
                        >
                            Share poll
                        </button>
                    </div>
                </div>
            )}

            {isRecording && (
                <div className="mb-3 glass-card rounded-2xl px-4 py-3 animate-slide-up border border-red-400/20">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                            <div>
                                <p className="text-sm font-semibold">Recording voice message</p>
                                <p className="text-xs opacity-55">Tap stop when you are ready to preview and send.</p>
                            </div>
                        </div>
                        <span className="badge-pill text-red-200">{formatRecordingTime(recordingSeconds)}</span>
                    </div>
                </div>
            )}

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
                    ) : mediaType === 'audio' ? (
                        <div className="max-w-[min(100%,22rem)] px-4 py-3 rounded-2xl bg-white/10 border border-white/10 min-w-[16rem]">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4 text-primary-300" />
                                    <span className="text-sm font-medium text-white">Voice message</span>
                                </div>
                                <span className="text-[11px] text-white/50">
                                    {(media.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </div>
                            <audio src={mediaPreview} controls className="w-full h-10" />
                        </div>
                    ) : mediaType === 'document' ? (
                        <div className="h-16 max-w-[min(100%,20rem)] px-4 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3 min-w-0">
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
                    {viewOnceEnabled && ['image', 'video'].includes(mediaType) && (
                        <div className="mt-2">
                            <span className="badge-pill bg-primary-500/15 text-primary-200 border-primary-400/20">
                                <EyeOff className="w-3.5 h-3.5" />
                                View once
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => { setMedia(null); setMediaPreview(null); setMediaType('text'); setViewOnceEnabled(false); }}
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
                <div className="mb-2 flex gap-1 overflow-x-auto pb-1 animate-slide-up no-scrollbar">
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
            <div className="surface-muted p-2.5 sm:p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge-pill">Messages</span>
                        {isGroup && <span className="badge-pill">Polls enabled</span>}
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => handleUnavailableFeature('GIF picker coming soon')}
                            className="badge-pill hover:opacity-100 opacity-70 transition-opacity whitespace-nowrap"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            GIF
                        </button>
                        <button
                            onClick={() => (isRecording ? stopVoiceRecording() : startVoiceRecording())}
                            className={`badge-pill hover:opacity-100 transition-opacity whitespace-nowrap ${isRecording ? 'text-red-200 border-red-400/20 bg-red-500/10 opacity-100' : 'opacity-70'}`}
                            disabled={disabled || isSending}
                        >
                            <Mic className="w-3.5 h-3.5" />
                            {isRecording ? 'Stop' : 'Voice'}
                        </button>
                        <button
                            onClick={() => {
                                setEditingScheduledMessage(null);
                                setShowScheduleComposer((current) => !current);
                                if (!showScheduleComposer) {
                                    setScheduledFor(getDefaultScheduleTime());
                                }
                            }}
                            className={`badge-pill hover:opacity-100 transition-opacity whitespace-nowrap ${showScheduleComposer ? 'opacity-100 bg-primary-500/15 text-primary-200 border-primary-400/20' : 'opacity-70'}`}
                            disabled={disabled || isRecording}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Later
                        </button>
                        {media && ['image', 'video'].includes(mediaType) && (
                            <button
                                onClick={() => setViewOnceEnabled((current) => !current)}
                                className={`badge-pill hover:opacity-100 transition-opacity whitespace-nowrap ${viewOnceEnabled ? 'opacity-100 bg-primary-500/15 text-primary-200 border-primary-400/20' : 'opacity-70'}`}
                                disabled={disabled || isRecording || isSending}
                            >
                                <EyeOff className="w-3.5 h-3.5" />
                                {viewOnceEnabled ? 'View once on' : 'View once'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-end gap-1.5 sm:gap-2">
                {/* Emoji toggle */}
                <button
                    onClick={() => setShowEmoji(!showEmoji)}
                    className={`icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px] flex-shrink-0 ${showEmoji ? 'bg-primary-500/20 text-primary-400' : ''}`}
                >
                    <Smile className="w-4 h-4 opacity-70" />
                </button>

                {/* Attach Menu */}
                <div className="relative">
                    {showAttach && (
                        <div className="absolute bottom-full mb-2 left-0 right-auto glass-card p-2 min-w-[140px] max-w-[min(16rem,calc(100vw-2rem))] flex flex-col gap-1 z-20 animate-slide-up">
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
                            {isGroup && (
                                <button
                                    onClick={() => {
                                        setShowPollComposer(true);
                                        setShowAttach(false);
                                    }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition-colors text-left"
                                >
                                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                                    <span>Poll</span>
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setShowAttach(!showAttach)}
                        className={`icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px] flex-shrink-0 ${showAttach ? 'bg-primary-500/20 text-primary-400' : ''}`}
                        title="Attach file"
                    >
                        <Paperclip className="w-4 h-4 opacity-70" />
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
                        placeholder={disabled ? 'Accept this request to reply' : 'Write a message...'}
                        rows={1}
                        className="input-glass py-2.5 sm:py-3 text-sm resize-none max-h-32 min-h-[44px] sm:min-h-[48px]"
                        style={{ height: 'auto', overflow: text.split('\n').length > 3 ? 'auto' : 'hidden' }}
                        disabled={disabled || isRecording}
                    />
                </div>

                {/* Send button (floating) */}
                <button
                    onClick={handleSend}
                    disabled={disabled || isSending || isRecording || (!text.trim() && !media)}
                    className="p-3 sm:p-3.5 rounded-[18px] sm:rounded-[20px] text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 hover:scale-105 active:scale-95"
                    style={{
                        background: text.trim() || media ? 'var(--gradient-primary)' : 'rgba(124, 92, 252, 0.2)',
                        boxShadow: text.trim() || media ? '0 14px 28px rgba(111, 107, 255, 0.24)' : 'none',
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
        </div>
    );
}
