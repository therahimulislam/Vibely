import { useEffect, useMemo, useState } from 'react';
import { Globe, Instagram, AtSign, ImageIcon, Shield, Users, X, Pin, FileText, Link2, Mic, BellRing, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import api from '../../api/axios';
import AvatarFallback from '../ui/AvatarFallback';
import { formatLastSeen } from '../../utils/formatters';

const InfoRow = ({ label, value }) => (
    <div>
        <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">{label}</label>
        <div className="glass-card px-4 py-3 rounded-xl">
            <span className="text-sm opacity-75">{value}</span>
        </div>
    </div>
);

const normalizeLink = (value = '') => {
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const getPinnedPreview = (message) => {
    if (!message) return 'Pinned message';
    if (message.isDeleted) return 'Deleted message';
    if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
    if (message.type === 'poll') return message.poll?.question || 'Pinned poll';
    if (message.type === 'image') return message.text || 'Photo';
    if (message.type === 'video') return message.text || 'Video';
    if (message.type === 'audio') return 'Voice message';
    if (message.type === 'document') return message.fileName || message.text || 'Document';
    return message.text || 'Pinned message';
};

const ChatLibrarySection = ({ activeTab, setActiveTab, items, counts, isLoading }) => {
    const tabs = [
        { value: 'media', label: 'Media', icon: ImageIcon },
        { value: 'docs', label: 'Files', icon: FileText },
        { value: 'links', label: 'Links', icon: Link2 },
        { value: 'voice', label: 'Voice', icon: Mic },
    ];

    return (
        <section className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-4 h-4 text-primary-400" />
                <h3 className="font-semibold text-sm">Chat Library</h3>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
                {tabs.map(({ value, label, icon: Icon }) => (
                    <button
                        key={value}
                        onClick={() => setActiveTab(value)}
                        className={`badge-pill whitespace-nowrap transition-all ${activeTab === value ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''}`}
                        style={activeTab === value ? { background: 'var(--gradient-primary)' } : undefined}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                        <span className="opacity-60">{counts?.[value] || 0}</span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full" />
                </div>
            ) : activeTab === 'media' ? (
                items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {items.map((item) => (
                            <a
                                key={item._id}
                                href={item.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-white/8 bg-white/5 p-2 hover:bg-white/8 transition-colors"
                            >
                                {item.type === 'image' ? (
                                    <img src={item.fileUrl} alt={item.fileName || 'Shared media'} className="w-full h-28 rounded-xl object-cover mb-2" />
                                ) : (
                                    <video src={item.fileUrl} className="w-full h-28 rounded-xl object-cover mb-2" muted playsInline />
                                )}
                                <p className="text-xs opacity-60 truncate">{item.senderId?.name || 'Shared media'}</p>
                            </a>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                        No media shared in this chat yet.
                    </div>
                )
            ) : (
                <div className="space-y-3">
                    {items.length > 0 ? items.map((item) => (
                        <div key={item._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                            {activeTab === 'voice' ? (
                                <div>
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div>
                                            <p className="text-sm font-semibold">{item.senderId?.name || 'Voice message'}</p>
                                            <p className="text-xs opacity-45">
                                                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <Mic className="w-4 h-4 text-primary-300" />
                                    </div>
                                    <audio src={item.fileUrl} controls className="w-full h-10" />
                                </div>
                            ) : activeTab === 'links' ? (
                                <a href={item.primaryUrl} target="_blank" rel="noreferrer" className="block hover:opacity-90 transition-opacity">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Link2 className="w-4 h-4 text-primary-300" />
                                        <p className="text-sm font-semibold truncate">{item.primaryUrl}</p>
                                    </div>
                                    <p className="text-xs opacity-55 break-words">{item.text || 'Shared link'}</p>
                                </a>
                            ) : (
                                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                                    <div className="p-2.5 bg-white/10 rounded-xl">
                                        <FileText className="w-5 h-5 text-primary-300" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{item.fileName || 'File'}</p>
                                        <p className="text-xs opacity-45 truncate">
                                            {item.senderId?.name || 'Shared file'} • {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Document'}
                                        </p>
                                    </div>
                                </a>
                            )}
                        </div>
                    )) : (
                        <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                            No {activeTab === 'docs' ? 'files' : activeTab} shared in this chat yet.
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default function ChatDetailsDrawer({ mode, user: initialUser, chat, onClose }) {
    const { user: currentUser, saveChatNotificationSettings } = useAuthStore();
    const { pinnedMessages, isLoadingPinnedMessages, fetchPinnedMessages, togglePinMessage } = useChatStore();
    const [profileUser, setProfileUser] = useState(initialUser);
    const [isLoading, setIsLoading] = useState(mode === 'user');
    const [assetTab, setAssetTab] = useState('media');
    const [chatAssets, setChatAssets] = useState([]);
    const [chatAssetCounts, setChatAssetCounts] = useState({ media: 0, docs: 0, links: 0, voice: 0 });
    const [isLoadingAssets, setIsLoadingAssets] = useState(false);
    const [notificationSettings, setNotificationSettings] = useState({
        mutedUntil: null,
        mentionsOnly: false,
        sound: 'default',
        desktop: false,
    });
    const groupParticipants = useMemo(
        () => (chat?.participants || []).filter(Boolean),
        [chat?.participants]
    );

    useEffect(() => {
        if (mode !== 'user' || !initialUser?._id) {
            setProfileUser(initialUser);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        api.get(`/users/${initialUser._id}`)
            .then(({ data }) => {
                if (isMounted) {
                    setProfileUser(data.user);
                }
            })
            .catch(() => {
                if (isMounted) {
                    toast.error('Failed to load profile');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [mode, initialUser?._id]);

    useEffect(() => {
        if (!chat?._id) return;
        fetchPinnedMessages(chat._id).catch(() => { });
    }, [chat?._id, fetchPinnedMessages]);

    useEffect(() => {
        if (!chat?._id) return;

        let isMounted = true;
        setIsLoadingAssets(true);

        api.get(`/chats/${chat._id}/assets?tab=${assetTab}`)
            .then(({ data }) => {
                if (!isMounted) return;
                setChatAssets(data.items || []);
                setChatAssetCounts(data.counts || { media: 0, docs: 0, links: 0, voice: 0 });
            })
            .catch(() => {
                if (isMounted) {
                    toast.error('Failed to load chat library');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingAssets(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [chat?._id, assetTab]);

    useEffect(() => {
        if (!chat?._id) return;
        const existing = (currentUser?.preferences?.chatNotifications || []).find((entry) => `${entry.chatId}` === `${chat._id}`);
        setNotificationSettings({
            mutedUntil: existing?.mutedUntil || null,
            mentionsOnly: !!existing?.mentionsOnly,
            sound: existing?.sound || 'default',
            desktop: !!existing?.desktop,
        });
    }, [chat?._id, currentUser?.preferences?.chatNotifications]);

    const groupAdminId = useMemo(() => {
        if (!chat?.groupAdmin) return null;
        return chat.groupAdmin?._id || chat.groupAdmin;
    }, [chat?.groupAdmin]);

    const isCurrentUserGroupAdmin = currentUser?._id && groupAdminId === currentUser._id;
    const canManagePins = !chat?.isGroup || isCurrentUserGroupAdmin;
    const getMutePresetId = (mutedUntil) => {
        if (!mutedUntil) return 'off';
        const diff = new Date(mutedUntil).getTime() - Date.now();
        if (Number.isNaN(diff) || diff <= 0) return 'off';
        if (diff > 10 * 365 * 24 * 60 * 60 * 1000) return 'always';
        if (diff <= 2 * 60 * 60 * 1000) return '1h';
        if (diff <= 10 * 60 * 60 * 1000) return '8h';
        return '1w';
    };
    const activeMutePreset = getMutePresetId(notificationSettings.mutedUntil);
    const notificationMuteOptions = [
        { value: 'off', label: 'All', mutedUntil: null },
        { value: '1h', label: '1 hour', mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
        { value: '8h', label: '8 hours', mutedUntil: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() },
        { value: '1w', label: '1 week', mutedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
        { value: 'always', label: 'Always', mutedUntil: new Date('2999-12-31T00:00:00.000Z').toISOString() },
    ];

    const persistNotificationSettings = async (partial) => {
        if (!chat?._id) return;
        const nextSettings = {
            ...notificationSettings,
            ...partial,
        };

        if (nextSettings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.error('Notification permission request failed:', error);
            }
        }

        setNotificationSettings(nextSettings);
        try {
            await saveChatNotificationSettings({
                chatId: chat._id,
                mutedUntil: nextSettings.mutedUntil,
                mentionsOnly: nextSettings.mentionsOnly,
                sound: nextSettings.sound,
                desktop: nextSettings.desktop,
            });
            toast.success('Notification settings saved');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const NotificationSection = ({ isGroupChat = false }) => (
        <section className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
                <BellRing className="w-4 h-4 text-primary-400" />
                <h3 className="font-semibold text-sm">Notifications</h3>
            </div>

            <div className="space-y-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Mute this chat</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {notificationMuteOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => persistNotificationSettings({ mutedUntil: option.mutedUntil })}
                                className={`badge-pill whitespace-nowrap transition-all ${activeMutePreset === option.value ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''}`}
                                style={activeMutePreset === option.value ? { background: 'var(--gradient-primary)' } : undefined}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {isGroupChat && (
                    <button
                        onClick={() => persistNotificationSettings({ mentionsOnly: !notificationSettings.mentionsOnly })}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-left hover:bg-white/8 transition-colors"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Mentions only</p>
                                <p className="text-xs opacity-45 mt-1">Only notify when someone mentions your username.</p>
                            </div>
                            <span className={`badge-pill ${notificationSettings.mentionsOnly ? '!bg-primary-500/15 !text-primary-200' : ''}`}>
                                {notificationSettings.mentionsOnly ? 'On' : 'Off'}
                            </span>
                        </div>
                    </button>
                )}

                <button
                    onClick={() => persistNotificationSettings({ desktop: !notificationSettings.desktop })}
                    className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-left hover:bg-white/8 transition-colors"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold">Desktop alerts</p>
                            <p className="text-xs opacity-45 mt-1">Show lightweight browser notifications when you are away from this chat.</p>
                        </div>
                        <span className={`badge-pill ${notificationSettings.desktop ? '!bg-primary-500/15 !text-primary-200' : ''}`}>
                            {notificationSettings.desktop ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </button>

                <div>
                    <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Sound</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => persistNotificationSettings({ sound: 'default' })}
                            className={`rounded-2xl border px-4 py-3 flex items-center gap-2 text-sm transition-colors ${notificationSettings.sound === 'default' ? 'border-primary-400/30 bg-primary-500/10 text-primary-100' : 'border-white/8 bg-white/5 hover:bg-white/8'}`}
                        >
                            <Volume2 className="w-4 h-4" />
                            Default tone
                        </button>
                        <button
                            onClick={() => persistNotificationSettings({ sound: 'silent' })}
                            className={`rounded-2xl border px-4 py-3 flex items-center gap-2 text-sm transition-colors ${notificationSettings.sound === 'silent' ? 'border-primary-400/30 bg-primary-500/10 text-primary-100' : 'border-white/8 bg-white/5 hover:bg-white/8'}`}
                        >
                            <VolumeX className="w-4 h-4" />
                            Silent
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );

    return (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full sm:max-w-sm md:max-w-md lg:max-w-lg h-[100dvh] glass-panel animate-slide-in-right border-l border-white/5 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 p-4 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-[rgba(10,12,20,0.45)]">
                    <div>
                        <h2 className="font-semibold text-sm">
                            {mode === 'group' ? 'Group Details' : 'Profile'}
                        </h2>
                        <p className="text-xs opacity-45 mt-0.5">
                            {mode === 'group'
                                ? 'Members, roles, and permissions'
                                : 'View this contact’s public profile'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-50" />
                    </button>
                </div>

                {mode === 'group' ? (
                    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary-500/20 mb-5">
                                    {chat?.groupAvatar ? (
                                        <img src={chat.groupAvatar} alt={chat.groupName} className="w-full h-full object-cover" />
                                    ) : (
                                        <AvatarFallback name={chat?.groupName || 'Group'} className="text-3xl" variant="group" icon={<Users className="w-10 h-10" />} />
                                    )}
                                </div>
                                <h3 className="text-lg font-semibold">{chat?.groupName || 'Group Chat'}</h3>
                                <p className="text-sm opacity-55">{groupParticipants.length} members</p>
                            </div>

                            <div className="mt-6 space-y-4">
                                <InfoRow
                                    label="Your Permission"
                                    value={isCurrentUserGroupAdmin ? 'Admin - can add members and manage the group' : 'Member - can chat, join calls, and view group details'}
                                />
                                <InfoRow
                                    label="Group Admin"
                                    value={chat?.groupAdmin?.name
                                        ? `${chat.groupAdmin.name}${chat.groupAdmin.username ? ` (@${chat.groupAdmin.username})` : ''}`
                                        : 'Unknown'}
                                />
                                <InfoRow
                                    label="What Members Can Do"
                                    value={isCurrentUserGroupAdmin
                                        ? 'You can add members. Everyone can message, react, share media, and join group calls.'
                                        : 'Members can message, react, share media, and join group calls. Only admins can add members.'}
                                />
                            </div>
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Pin className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Pinned Board</h3>
                            </div>

                            <div className="space-y-3">
                                {isLoadingPinnedMessages ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="animate-spin w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full" />
                                    </div>
                                ) : pinnedMessages.length > 0 ? (
                                    pinnedMessages.map((message) => (
                                        <div key={message._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <p className="text-sm font-semibold">
                                                            {message.senderId?.name || 'Pinned message'}
                                                        </p>
                                                        <span className="badge-pill">
                                                            {new Date(message.pinnedAt || message.createdAt).toLocaleDateString([], {
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm opacity-70 break-words">
                                                        {getPinnedPreview(message)}
                                                    </p>
                                                </div>
                                                {canManagePins && (
                                                    <button
                                                        onClick={() => togglePinMessage(message._id)}
                                                        className="p-2 rounded-xl hover:bg-white/5 flex-shrink-0"
                                                        title="Unpin message"
                                                    >
                                                        <Pin className="w-4 h-4 text-primary-300" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm opacity-60">
                                        No pinned messages yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        <ChatLibrarySection
                            activeTab={assetTab}
                            setActiveTab={setAssetTab}
                            items={chatAssets}
                            counts={chatAssetCounts}
                            isLoading={isLoadingAssets}
                        />

                        <NotificationSection isGroupChat />

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Members & Roles</h3>
                            </div>

                            <div className="space-y-3">
                                {groupParticipants.map((participant) => {
                                    const role = groupAdminId === participant._id ? 'Admin' : 'Member';
                                    const isSelf = participant._id === currentUser?._id;

                                    return (
                                        <div key={participant._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                    {participant.avatar ? (
                                                        <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <AvatarFallback name={participant.name} className="text-lg" />
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold truncate">{participant.name}</p>
                                                        {isSelf && (
                                                            <span className="badge-pill">You</span>
                                                        )}
                                                        <span className={`badge-pill ${role === 'Admin' ? '!bg-primary-500/15 !text-primary-300' : ''}`}>
                                                            {role}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs opacity-45 truncate mt-1">
                                                        {participant.username ? `@${participant.username}` : 'No username'}
                                                    </p>
                                                    <p className="text-xs opacity-45 mt-1">
                                                        {role === 'Admin'
                                                            ? 'Can add members and manage group settings'
                                                            : 'Can send messages, join calls, and view shared group info'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {groupParticipants.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm opacity-60">
                                        No group members available right now.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary-500/20 mb-5">
                                    {profileUser?.avatar ? (
                                        <img src={profileUser.avatar} alt={profileUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <AvatarFallback name={profileUser?.name} className="text-3xl" />
                                    )}
                                </div>
                                <h3 className="text-lg font-semibold">{profileUser?.name || 'User'}</h3>
                                <p className="text-sm opacity-55">@{profileUser?.username}</p>
                                {profileUser?.bio && (
                                    <p className="text-sm opacity-65 mt-3 max-w-sm leading-6">
                                        {profileUser.bio}
                                    </p>
                                )}
                                <p className="text-xs opacity-45 mt-2">
                                    {profileUser?.isOnline ? 'Online now' : `Last seen ${formatLastSeen(profileUser?.lastSeen)}`}
                                </p>
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                                </div>
                            ) : (
                                <div className="mt-6 space-y-4">
                                    <InfoRow label="Name" value={profileUser?.name || 'Unknown'} />
                                    <InfoRow label="Username" value={profileUser?.username ? `@${profileUser.username}` : 'Unknown'} />
                                    <InfoRow label="Bio" value={profileUser?.bio || 'No bio yet'} />
                                    <InfoRow label="Contact Status" value={profileUser?.isContact ? 'Saved in your contacts' : 'Not saved in your contacts'} />
                                    <InfoRow
                                        label="Joined"
                                        value={profileUser?.createdAt
                                            ? new Date(profileUser.createdAt).toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' })
                                            : 'Unknown'}
                                    />
                                </div>
                            )}
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Pin className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Pinned Board</h3>
                            </div>

                            <div className="space-y-3">
                                {isLoadingPinnedMessages ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="animate-spin w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full" />
                                    </div>
                                ) : pinnedMessages.length > 0 ? (
                                    pinnedMessages.map((message) => (
                                        <div key={message._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <p className="text-sm font-semibold">
                                                            {message.senderId?.name || 'Pinned message'}
                                                        </p>
                                                        <span className="badge-pill">
                                                            {new Date(message.pinnedAt || message.createdAt).toLocaleDateString([], {
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm opacity-70 break-words">
                                                        {getPinnedPreview(message)}
                                                    </p>
                                                </div>
                                                {canManagePins && (
                                                    <button
                                                        onClick={() => togglePinMessage(message._id)}
                                                        className="p-2 rounded-xl hover:bg-white/5 flex-shrink-0"
                                                        title="Unpin message"
                                                    >
                                                        <Pin className="w-4 h-4 text-primary-300" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                                        No pinned messages yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        <ChatLibrarySection
                            activeTab={assetTab}
                            setActiveTab={setAssetTab}
                            items={chatAssets}
                            counts={chatAssetCounts}
                            isLoading={isLoadingAssets}
                        />

                        <NotificationSection isGroupChat={false} />

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Links & Presence</h3>
                            </div>

                            <div className="space-y-3">
                                {profileUser?.socialLinks?.website && (
                                    <a
                                        href={normalizeLink(profileUser.socialLinks.website)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="glass-card px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-white/5 transition-colors"
                                    >
                                        <Globe className="w-4 h-4 text-primary-300" />
                                        <span className="text-sm opacity-75 break-all">{profileUser.socialLinks.website}</span>
                                    </a>
                                )}
                                {profileUser?.socialLinks?.instagram && (
                                    <div className="glass-card px-4 py-3 rounded-xl flex items-center gap-3">
                                        <Instagram className="w-4 h-4 text-primary-300" />
                                        <span className="text-sm opacity-75 break-all">{profileUser.socialLinks.instagram}</span>
                                    </div>
                                )}
                                {profileUser?.socialLinks?.x && (
                                    <div className="glass-card px-4 py-3 rounded-xl flex items-center gap-3">
                                        <AtSign className="w-4 h-4 text-primary-300" />
                                        <span className="text-sm opacity-75 break-all">{profileUser.socialLinks.x}</span>
                                    </div>
                                )}
                                {!profileUser?.socialLinks?.website && !profileUser?.socialLinks?.instagram && !profileUser?.socialLinks?.x && (
                                    <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                                        No public links shared yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Mutual Groups</h3>
                            </div>

                            <div className="space-y-3">
                                {(profileUser?.mutualGroups || []).map((group) => (
                                    <div key={group._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                {group.avatar ? (
                                                    <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <AvatarFallback name={group.name} className="text-sm" variant="group" icon={<Users className="w-5 h-5" />} />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{group.name}</p>
                                                <p className="text-xs opacity-45">{group.memberCount} members</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!profileUser?.mutualGroups || profileUser.mutualGroups.length === 0) && (
                                    <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                                        No mutual groups yet.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <ImageIcon className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Shared Media</h3>
                            </div>

                            {(profileUser?.sharedMedia || []).length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {profileUser.sharedMedia.map((item) => (
                                        <a
                                            key={item._id}
                                            href={item.fileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-2xl border border-white/8 bg-white/5 p-3 hover:bg-white/8 transition-colors"
                                        >
                                            {item.type === 'image' ? (
                                                <img src={item.fileUrl} alt={item.fileName || 'Shared media'} className="w-full h-24 rounded-xl object-cover mb-2" />
                                            ) : (
                                                <div className="w-full h-24 rounded-xl mb-2 flex items-center justify-center text-xs font-semibold text-white/80"
                                                    style={{ background: 'var(--gradient-primary)' }}>
                                                    {item.type.toUpperCase()}
                                                </div>
                                            )}
                                            <p className="text-xs opacity-65 truncate">{item.fileName || `${item.type} item`}</p>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="glass-card px-4 py-3 rounded-xl text-sm opacity-55">
                                    No shared media yet.
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
