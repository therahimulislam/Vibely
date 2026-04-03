import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Instagram, AtSign, ImageIcon, Shield, Users, X, Pin, FileText, Link2, Mic, BellRing, Volume2, VolumeX, Clock3, Copy, Link2Off, UserPlus, Camera, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import api from '../../api/axios';
import AvatarFallback from '../ui/AvatarFallback';
import { formatLastSeen } from '../../utils/formatters';
import { getDisplayName } from '../../utils/userDisplay';

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
    const {
        pinnedMessages,
        isLoadingPinnedMessages,
        fetchPinnedMessages,
        togglePinMessage,
        addToGroup,
        removeFromGroup,
        updateGroupMemberRole,
        updateGroupProfile,
        updateGroupSettings,
        createInviteLink,
        revokeInviteLink,
        reviewJoinRequest,
    } = useChatStore();
    const [profileUser, setProfileUser] = useState(initialUser);
    const [groupChatState, setGroupChatState] = useState(chat);
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
    const [memberUsername, setMemberUsername] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [isSearchingMembers, setIsSearchingMembers] = useState(false);
    const [isUpdatingGroupAvatar, setIsUpdatingGroupAvatar] = useState(false);
    const avatarInputRef = useRef(null);
    const activeChat = mode === 'group' ? (groupChatState || chat) : chat;
    const groupParticipants = useMemo(
        () => (activeChat?.participants || []).filter(Boolean),
        [activeChat?.participants]
    );

    useEffect(() => {
        setGroupChatState(chat);
    }, [chat]);

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
        if (!activeChat?._id) return;
        fetchPinnedMessages(activeChat._id).catch(() => { });
    }, [activeChat?._id, fetchPinnedMessages]);

    useEffect(() => {
        if (!activeChat?._id) return;

        let isMounted = true;
        setIsLoadingAssets(true);

        api.get(`/chats/${activeChat._id}/assets?tab=${assetTab}`)
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
    }, [activeChat?._id, assetTab]);

    useEffect(() => {
        if (!activeChat?._id) return;
        const existing = (currentUser?.preferences?.chatNotifications || []).find((entry) => `${entry.chatId}` === `${activeChat._id}`);
        setNotificationSettings({
            mutedUntil: existing?.mutedUntil || null,
            mentionsOnly: !!existing?.mentionsOnly,
            sound: existing?.sound || 'default',
            desktop: !!existing?.desktop,
        });
    }, [activeChat?._id, currentUser?.preferences?.chatNotifications]);

    const groupOwnerId = useMemo(() => {
        if (!activeChat?.groupOwner && !activeChat?.groupAdmin) return null;
        return activeChat?.groupOwner?._id || activeChat?.groupOwner || activeChat?.groupAdmin?._id || activeChat?.groupAdmin || null;
    }, [activeChat?.groupOwner, activeChat?.groupAdmin]);
    const groupAdminIds = useMemo(() => {
        const explicitAdmins = Array.isArray(activeChat?.groupAdmins) ? activeChat.groupAdmins : [];
        const normalized = explicitAdmins
            .map((entry) => entry?._id || entry)
            .filter(Boolean)
            .map((entry) => `${entry}`);

        if (groupOwnerId && !normalized.includes(`${groupOwnerId}`)) {
            normalized.push(`${groupOwnerId}`);
        }

        if (!normalized.length && activeChat?.groupAdmin) {
            normalized.push(`${activeChat.groupAdmin?._id || activeChat.groupAdmin}`);
        }

        return Array.from(new Set(normalized));
    }, [activeChat?.groupAdmins, activeChat?.groupAdmin, groupOwnerId]);
    const groupAdminUsers = useMemo(() => (
        groupParticipants.filter((participant) => groupAdminIds.some((adminId) => `${participant?._id}` === `${adminId}`))
    ), [groupParticipants, groupAdminIds]);

    const isCurrentUserGroupAdmin = !!currentUser?._id && groupAdminIds.some((adminId) => `${adminId}` === `${currentUser._id}`);
    const isCurrentUserGroupOwner = !!currentUser?._id && `${groupOwnerId}` === `${currentUser._id}`;
    useEffect(() => {
        if (mode !== 'group' || !isCurrentUserGroupAdmin) {
            setMemberSearchResults([]);
            setIsSearchingMembers(false);
            return undefined;
        }

        const normalizedQuery = memberUsername.trim().replace(/^@/, '');
        if (!normalizedQuery) {
            setMemberSearchResults([]);
            setIsSearchingMembers(false);
            return undefined;
        }

        const timer = setTimeout(async () => {
            setIsSearchingMembers(true);
            try {
                const { data } = await api.get(`/users?search=${encodeURIComponent(normalizedQuery)}`);
                const participantIds = new Set((groupParticipants || []).map((participant) => `${participant?._id || ''}`));
                setMemberSearchResults(
                    (data.users || []).filter((candidate) => candidate?._id && !participantIds.has(`${candidate._id}`))
                );
            } catch (error) {
                setMemberSearchResults([]);
            } finally {
                setIsSearchingMembers(false);
            }
        }, 240);

        return () => clearTimeout(timer);
    }, [memberUsername, mode, isCurrentUserGroupAdmin, groupParticipants]);

    const normalizedGroupSettings = {
        adminOnlyMessages: false,
        allowMemberMedia: true,
        allowMemberPolls: true,
        joinApprovalEnabled: false,
        slowModeSeconds: 0,
        ...(activeChat?.groupSettings || {}),
    };
    const disappearingSettings = {
        enabled: false,
        durationHours: 0,
        ...(activeChat?.disappearingMessages || {}),
    };
    const disappearingOptions = [
        { value: 0, label: 'Off' },
        { value: 24, label: '24h' },
        { value: 168, label: '7d' },
        { value: 2160, label: '90d' },
    ];
    const slowModeOptions = [
        { value: 0, label: 'Off' },
        { value: 15, label: '15s' },
        { value: 30, label: '30s' },
        { value: 60, label: '1m' },
        { value: 300, label: '5m' },
        { value: 900, label: '15m' },
        { value: 3600, label: '1h' },
    ];
    const activeInviteLinks = (activeChat?.inviteLinks || []).filter((entry) => !entry?.revokedAt);
    const pendingJoinRequests = activeChat?.pendingJoinRequests || [];
    const canManagePins = !activeChat?.isGroup || isCurrentUserGroupAdmin;
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
        if (!activeChat?._id) return;
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
                chatId: activeChat._id,
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
    const persistGroupControls = async (partial = {}) => {
        if (!activeChat?._id || !isCurrentUserGroupAdmin) return;
        try {
            const nextChat = await updateGroupSettings(activeChat._id, {
                groupSettings: {
                    ...normalizedGroupSettings,
                    ...(partial.groupSettings || {}),
                },
                disappearingMessages: {
                    ...disappearingSettings,
                    ...(partial.disappearingMessages || {}),
                },
            });
            setGroupChatState(nextChat);
        } catch (error) {
            console.error('Failed to persist group controls', error);
        }
    };
    const handleCopyInviteLink = async (inviteLink, { silent = false } = {}) => {
        const fallbackUrl = `${window.location.origin.replace(/\/$/, '')}/join/${inviteLink.code}`;
        const value = inviteLink.url || fallbackUrl;
        try {
            await navigator.clipboard.writeText(value);
            if (!silent) {
                toast.success('Invite link copied');
            }
        } catch (error) {
            toast.error('Unable to copy invite link');
        }
    };
    const handleCreateInviteLink = async () => {
        if (!activeChat?._id) return;
        try {
            const result = await createInviteLink(activeChat._id);
            if (result?.chat) {
                setGroupChatState(result.chat);
            }
            if (result?.inviteLink) {
                await handleCopyInviteLink(result.inviteLink, { silent: true });
            }
        } catch (error) {
            console.error('Failed to create invite link', error);
        }
    };
    const handleAddMember = async (selectedUser = null) => {
        const username = memberUsername.trim().replace(/^@/, '');
        const selectedUserId = selectedUser?._id || null;
        if ((!username && !selectedUserId) || !activeChat?._id) {
            toast.error('Search for someone to add');
            return;
        }

        try {
            const nextChat = await addToGroup(activeChat._id, selectedUserId, selectedUserId ? null : username);
            setGroupChatState(nextChat);
            setMemberUsername('');
            setMemberSearchResults([]);
        } catch (error) {
            console.error('Failed to add member', error);
        }
    };
    const handleRemoveMember = async (participantId) => {
        if (!activeChat?._id) return;
        if (!window.confirm('Remove this member from the group?')) return;

        try {
            const nextChat = await removeFromGroup(activeChat._id, participantId);
            setGroupChatState(nextChat);
        } catch (error) {
            console.error('Failed to remove member', error);
        }
    };
    const handleUpdateMemberRole = async (participantId, nextRole) => {
        if (!activeChat?._id) return;
        try {
            const nextChat = await updateGroupMemberRole(activeChat._id, participantId, nextRole);
            setGroupChatState(nextChat);
        } catch (error) {
            console.error('Failed to update member role', error);
        }
    };
    const handleGroupAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !activeChat?._id) return;

        const formData = new FormData();
        formData.append('groupAvatar', file);

        setIsUpdatingGroupAvatar(true);
        try {
            const nextChat = await updateGroupProfile(activeChat._id, formData);
            setGroupChatState(nextChat);
        } catch (error) {
            console.error('Failed to update group icon', error);
        } finally {
            setIsUpdatingGroupAvatar(false);
            event.target.value = '';
        }
    };
    const memberPermissionSummary = normalizedGroupSettings.adminOnlyMessages
        ? 'Only admins can post right now. Members can still read, react, and join calls.'
        : `${normalizedGroupSettings.allowMemberMedia ? 'Members can share media.' : 'Media sharing is admin only.'} ${normalizedGroupSettings.allowMemberPolls ? 'Members can create polls.' : 'Polls are admin only.'}`;
    const adminSummary = groupAdminUsers.length > 0
        ? groupAdminUsers.map((participant) => participant?.name || participant?.username || 'Admin').join(', ')
        : 'No admins available';

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
                                <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary-500/20 mb-5">
                                    {activeChat?.groupAvatar ? (
                                        <img src={activeChat.groupAvatar} alt={activeChat.groupName} className="w-full h-full object-cover" />
                                    ) : (
                                        <AvatarFallback name={activeChat?.groupName || 'Group'} className="text-3xl" variant="group" icon={<Users className="w-10 h-10" />} />
                                    )}
                                    {isCurrentUserGroupAdmin && (
                                        <>
                                            <input
                                                ref={avatarInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleGroupAvatarChange}
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => avatarInputRef.current?.click()}
                                                disabled={isUpdatingGroupAvatar}
                                                className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors disabled:opacity-60"
                                                title="Change group icon"
                                            >
                                                {isUpdatingGroupAvatar ? (
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Camera className="w-4 h-4 text-white" />
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                                <h3 className="text-lg font-semibold">{activeChat?.groupName || 'Group Chat'}</h3>
                                <p className="text-sm opacity-55">{groupParticipants.length} members</p>
                                {isCurrentUserGroupAdmin && (
                                    <p className="text-xs opacity-45 mt-3">Tap the camera icon to add or change the group icon.</p>
                                )}
                            </div>

                            <div className="mt-6 space-y-4">
                                <InfoRow
                                    label="Your Permission"
                                    value={isCurrentUserGroupOwner
                                        ? 'Owner - created this group and cannot be demoted'
                                        : isCurrentUserGroupAdmin
                                            ? 'Admin - can manage members, invites, permissions, and disappearing timers'
                                            : 'Member - can chat within the current group rules and view shared details'}
                                />
                                <InfoRow
                                    label="Group Owner"
                                    value={activeChat?.groupOwner?.name || activeChat?.groupAdmin?.name
                                        ? `${activeChat.groupOwner?.name || activeChat.groupAdmin?.name}${(activeChat.groupOwner?.username || activeChat.groupAdmin?.username) ? ` (@${activeChat.groupOwner?.username || activeChat.groupAdmin?.username})` : ''}`
                                        : 'Unknown'}
                                />
                                <InfoRow
                                    label="Admins"
                                    value={adminSummary}
                                />
                                <InfoRow
                                    label="What Members Can Do"
                                    value={memberPermissionSummary}
                                />
                            </div>
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-primary-400" />
                                <h3 className="font-semibold text-sm">Group Controls</h3>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Disappearing messages</p>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                        {disappearingOptions.map((option) => {
                                            const isActive = (disappearingSettings.durationHours || 0) === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => persistGroupControls({ disappearingMessages: { durationHours: option.value } })}
                                                    disabled={!isCurrentUserGroupAdmin}
                                                    className={`badge-pill whitespace-nowrap transition-all ${isActive ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''} ${!isCurrentUserGroupAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    style={isActive ? { background: 'var(--gradient-primary)' } : undefined}
                                                >
                                                    <Clock3 className="w-3.5 h-3.5" />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs opacity-45 mt-2">
                                        New messages follow this timer. Existing messages keep their current state.
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Slow mode</p>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                        {slowModeOptions.map((option) => {
                                            const isActive = (normalizedGroupSettings.slowModeSeconds || 0) === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => persistGroupControls({ groupSettings: { slowModeSeconds: option.value } })}
                                                    disabled={!isCurrentUserGroupAdmin}
                                                    className={`badge-pill whitespace-nowrap transition-all ${isActive ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''} ${!isCurrentUserGroupAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    style={isActive ? { background: 'var(--gradient-primary)' } : undefined}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        {
                                            key: 'adminOnlyMessages',
                                            title: 'Admin-only posting',
                                            description: 'Only admins can send messages while this is enabled.',
                                            active: normalizedGroupSettings.adminOnlyMessages,
                                        },
                                        {
                                            key: 'allowMemberMedia',
                                            title: 'Member media sharing',
                                            description: 'Allow members to upload photos, videos, docs, and voice notes.',
                                            active: normalizedGroupSettings.allowMemberMedia,
                                        },
                                        {
                                            key: 'allowMemberPolls',
                                            title: 'Member polls',
                                            description: 'Allow members to create polls in the group.',
                                            active: normalizedGroupSettings.allowMemberPolls,
                                        },
                                        {
                                            key: 'joinApprovalEnabled',
                                            title: 'Join approval',
                                            description: 'Require admin approval before invite-link joins become members.',
                                            active: normalizedGroupSettings.joinApprovalEnabled,
                                        },
                                    ].map((setting) => (
                                        <button
                                            key={setting.key}
                                            onClick={() => persistGroupControls({ groupSettings: { [setting.key]: !setting.active } })}
                                            disabled={!isCurrentUserGroupAdmin}
                                            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${setting.active ? 'border-primary-400/30 bg-primary-500/10 text-primary-100' : 'border-white/8 bg-white/5 hover:bg-white/8'} ${!isCurrentUserGroupAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <p className="text-sm font-semibold">{setting.title}</p>
                                                <span className={`badge-pill ${setting.active ? '!bg-primary-500/15 !text-primary-200' : ''}`}>
                                                    {setting.active ? 'On' : 'Off'}
                                                </span>
                                            </div>
                                            <p className="text-xs opacity-55 leading-5">{setting.description}</p>
                                        </button>
                                    ))}
                                </div>

                                {!isCurrentUserGroupAdmin && (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm opacity-60">
                                        Only group admins can change these controls.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="glass-card rounded-3xl p-5 sm:p-6">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-primary-400" />
                                    <h3 className="font-semibold text-sm">Invite Links</h3>
                                </div>
                                {isCurrentUserGroupAdmin && (
                                    <button
                                        onClick={handleCreateInviteLink}
                                        className="btn-glass px-3 py-2 text-sm whitespace-nowrap"
                                    >
                                        Create link
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {activeInviteLinks.length > 0 ? activeInviteLinks.map((inviteLink) => (
                                    <div key={inviteLink.code} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <p className="text-sm font-semibold truncate">Invite code</p>
                                                    <span className="badge-pill">{inviteLink.code}</span>
                                                </div>
                                                <p className="text-xs opacity-45 break-all">
                                                    {inviteLink.url || `${window.location.origin.replace(/\/$/, '')}/join/${inviteLink.code}`}
                                                </p>
                                                <p className="text-[11px] opacity-35 mt-2">
                                                    Created {new Date(inviteLink.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleCopyInviteLink(inviteLink)}
                                                    className="p-2 rounded-xl hover:bg-white/5"
                                                    title="Copy invite link"
                                                >
                                                    <Copy className="w-4 h-4 text-primary-300" />
                                                </button>
                                                {isCurrentUserGroupAdmin && (
                                                    <button
                                                        onClick={() => revokeInviteLink(activeChat._id, inviteLink.code).then((nextChat) => {
                                                            setGroupChatState(nextChat);
                                                        }).catch(() => { })}
                                                        className="p-2 rounded-xl hover:bg-red-500/10 text-red-300"
                                                        title="Revoke invite link"
                                                    >
                                                        <Link2Off className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm opacity-60">
                                        {isCurrentUserGroupAdmin ? 'Create an invite link to let people join the group.' : 'No active invite links are visible to members right now.'}
                                    </div>
                                )}
                            </div>
                        </section>

                        {(isCurrentUserGroupAdmin || pendingJoinRequests.length > 0) && (
                            <section className="glass-card rounded-3xl p-5 sm:p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Users className="w-4 h-4 text-primary-400" />
                                    <h3 className="font-semibold text-sm">Pending Join Requests</h3>
                                </div>

                                <div className="space-y-3">
                                    {pendingJoinRequests.length > 0 ? pendingJoinRequests.map((request) => {
                                        const requester = request.userId;
                                        return (
                                            <div key={requester?._id || request.viaCode} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                            {requester?.avatar ? (
                                                                <img src={requester.avatar} alt={requester.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <AvatarFallback name={requester?.name || 'User'} className="text-sm" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">{requester?.name || 'Pending member'}</p>
                                                            <p className="text-xs opacity-45 truncate">
                                                                {requester?.username ? `@${requester.username}` : 'Invite request'}
                                                            </p>
                                                            <p className="text-[11px] opacity-35 mt-1">
                                                                Requested {new Date(request.requestedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isCurrentUserGroupAdmin && requester?._id && (
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <button
                                                                onClick={() => reviewJoinRequest(activeChat._id, requester._id, 'accept').then((nextChat) => {
                                                                    setGroupChatState(nextChat);
                                                                }).catch(() => { })}
                                                                className="btn-glass px-3 py-2 text-sm"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                onClick={() => reviewJoinRequest(activeChat._id, requester._id, 'reject').then((nextChat) => {
                                                                    setGroupChatState(nextChat);
                                                                }).catch(() => { })}
                                                                className="px-3 py-2 rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200 text-sm hover:bg-red-500/15 transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm opacity-60">
                                            No pending requests right now.
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

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

                            {isCurrentUserGroupAdmin && (
                                <div className="rounded-2xl border border-white/8 bg-white/5 p-4 mb-4">
                                    <p className="text-xs uppercase tracking-[0.18em] opacity-40 mb-2">Add member</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            value={memberUsername}
                                            onChange={(event) => setMemberUsername(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    handleAddMember(memberSearchResults[0] || null);
                                                }
                                            }}
                                            placeholder="Search by name or username..."
                                            className="input-glass py-2 text-sm"
                                        />
                                        <button
                                            onClick={() => handleAddMember(memberSearchResults[0] || null)}
                                            className="btn-glass px-4 py-2 text-sm whitespace-nowrap"
                                        >
                                            <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add</span>
                                        </button>
                                    </div>
                                    <p className="text-xs opacity-45 mt-2">Type a name or username, then tap the person you want to add.</p>
                                    {(isSearchingMembers || memberSearchResults.length > 0 || memberUsername.trim()) && (
                                        <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
                                            {isSearchingMembers ? (
                                                <div className="rounded-2xl border border-white/8 bg-white/5 p-3 text-sm opacity-60">
                                                    Searching people...
                                                </div>
                                            ) : memberSearchResults.length > 0 ? memberSearchResults.map((candidate) => {
                                                const displayName = getDisplayName(candidate, currentUser);
                                                return (
                                                    <button
                                                        key={candidate._id}
                                                        type="button"
                                                        onClick={() => handleAddMember(candidate)}
                                                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-3 py-3 hover:bg-white/8 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                                {candidate.avatar ? (
                                                                    <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <AvatarFallback name={candidate.name} className="text-sm" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold truncate">{displayName}</p>
                                                                {displayName !== candidate.name && (
                                                                    <p className="text-xs opacity-45 truncate">{candidate.name}</p>
                                                                )}
                                                                <p className="text-xs opacity-45 truncate">
                                                                    {candidate.username ? `@${candidate.username}` : 'No username'}
                                                                </p>
                                                            </div>
                                                            <span className="badge-pill !bg-primary-500/15 !text-primary-200">
                                                                Add
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            }) : (
                                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-3 text-sm opacity-60">
                                                    No people found with that name or username.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3">
                                {groupParticipants.map((participant) => {
                                    const isOwner = `${groupOwnerId}` === `${participant._id}`;
                                    const isAdmin = groupAdminIds.some((adminId) => `${adminId}` === `${participant._id}`);
                                    const role = isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member';
                                    const isSelf = `${participant._id}` === `${currentUser?._id}`;

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
                                                        <span className={`badge-pill ${role !== 'Member' ? '!bg-primary-500/15 !text-primary-300' : ''}`}>
                                                            {role}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs opacity-45 truncate mt-1">
                                                        {participant.username ? `@${participant.username}` : 'No username'}
                                                    </p>
                                                    <p className="text-xs opacity-45 mt-1">
                                                        {role === 'Owner'
                                                            ? 'Created the group and always stays the owner'
                                                            : role === 'Admin'
                                                            ? 'Can add members and manage group settings'
                                                            : 'Can send messages, join calls, and view shared group info'}
                                                    </p>
                                                </div>
                                                {isCurrentUserGroupAdmin && !isSelf && !isOwner && (
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {isAdmin ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateMemberRole(participant._id, 'member')}
                                                                className="px-3 py-2 rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-200 text-xs hover:bg-amber-500/15 transition-colors"
                                                                title="Change to member"
                                                            >
                                                                Make Member
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateMemberRole(participant._id, 'admin')}
                                                                className="px-3 py-2 rounded-xl border border-primary-400/20 bg-primary-500/10 text-primary-100 text-xs hover:bg-primary-500/15 transition-colors"
                                                                title="Make admin"
                                                            >
                                                                Make Admin
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMember(participant._id)}
                                                            className="p-2 rounded-xl hover:bg-red-500/10 text-red-300 flex-shrink-0"
                                                            title="Remove member"
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
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
