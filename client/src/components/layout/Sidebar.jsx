// client/src/components/layout/Sidebar.jsx
// Left sidebar with header, search, chat list, and new chat

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Settings, LogOut, MessageCircle, X, Users, Check, UserRoundPlus, UserRoundMinus, Sparkles, Bookmark, Trash2, BellRing, Link2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useStatusStore from '../../store/useStatusStore';
import useReminderStore from '../../store/useReminderStore';
import ChatList from '../chat/ChatList';
import StatusStrip from '../status/StatusStrip';
import StatusComposerModal from '../status/StatusComposerModal';
import StatusViewer from '../status/StatusViewer';
import ThemeToggle from './ThemeToggle';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AvatarFallback from '../ui/AvatarFallback';

export default function Sidebar({ onProfileClick }) {
    const { user, logout, addContact, removeContact, saveChatFolders } = useAuthStore();
    const {
        chats,
        searchQuery,
        setSearchQuery,
        createChat,
        openSavedMessages,
        setActiveChat,
        fetchChats,
        fetchBookmarkCollections,
        bookmarkCollections,
        isLoadingBookmarkCollections,
        getInviteInfo,
        joinGroupViaInvite,
        error,
    } = useChatStore();
    const { myStatuses, statuses, fetchStatuses, isLoading: isLoadingStatuses } = useStatusStore();
    const { reminders, isLoadingReminders, fetchReminders, deleteReminder } = useReminderStore();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showJoinGroup, setShowJoinGroup] = useState(false);
    const [showFolderManager, setShowFolderManager] = useState(false);
    const [showCollections, setShowCollections] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    const [showStatusComposer, setShowStatusComposer] = useState(false);
    const [isOwnStatusGroup, setIsOwnStatusGroup] = useState(false);
    const [activeStatusUserId, setActiveStatusUserId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchUsers, setSearchUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [inviteCodeInput, setInviteCodeInput] = useState('');
    const [invitePreview, setInvitePreview] = useState(null);
    const [isLoadingInvitePreview, setIsLoadingInvitePreview] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [chatFilter, setChatFilter] = useState('all');
    const [activeFolderId, setActiveFolderId] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#6f6bff');
    const [folderDraftName, setFolderDraftName] = useState('');
    const [folderDraftColor, setFolderDraftColor] = useState('#6f6bff');
    const chatFolders = user?.preferences?.chatFolders || [];
    const folderColorOptions = ['#6f6bff', '#12b981', '#f97316', '#06b6d4', '#ec4899', '#eab308'];
    const activeFolder = chatFolders.find((folder) => folder.folderId === activeFolderId) || null;
    const extractInviteCode = (value = '') =>
        `${value}`.trim().replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
    const closeCreationPanels = () => {
        setShowNewChat(false);
        setShowNewGroup(false);
        setShowJoinGroup(false);
        setGroupName('');
        setSelectedUsers([]);
        setUserSearchQuery('');
        setInviteCodeInput('');
        setInvitePreview(null);
    };

    const formatFolderChatLabel = (chat) => {
        if (chat.isSavedMessages) return 'Saved Messages';
        if (chat.isGroup) return chat.groupName || 'Group Chat';
        const participant = (chat.participants || []).filter(Boolean).find((entry) => entry._id !== user?._id);
        return participant?.name || 'Direct Chat';
    };
    const getBookmarkedMessagePreview = (message) => {
        if (!message) return 'Saved message';
        if (message.isDeleted) return 'Deleted message';
        if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
        if (message.type === 'poll') return message.poll?.question || 'Poll';
        if (message.type === 'image') return message.text || 'Photo';
        if (message.type === 'video') return message.text || 'Video';
        if (message.type === 'audio') return 'Voice message';
        if (message.type === 'document') return message.fileName || message.text || 'Document';
        return message.text || 'Message';
    };

    // Display store errors
    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    useEffect(() => {
        fetchReminders().catch(() => { });
    }, [fetchReminders]);

    useEffect(() => {
        if (!chatFolders.length) {
            setActiveFolderId('');
            return;
        }

        if (!activeFolderId || !chatFolders.some((folder) => folder.folderId === activeFolderId)) {
            setActiveFolderId(chatFolders[0].folderId);
        }
    }, [chatFolders, activeFolderId]);

    useEffect(() => {
        if (!activeFolder) {
            setFolderDraftName('');
            setFolderDraftColor('#6f6bff');
            return;
        }

        setFolderDraftName(activeFolder.name);
        setFolderDraftColor(activeFolder.color || '#6f6bff');
    }, [activeFolder?.folderId, activeFolder?.name, activeFolder?.color]);

    // Search users for new chat (Use recents from chats if empty)
    useEffect(() => {
        if (!userSearchQuery.trim()) {
            const recentUsersMap = new Map();
            chats.forEach(chat => {
                if (!chat.isGroup && !chat.isSavedMessages) {
                    chat.participants?.forEach(p => {
                        if (p && typeof p === 'object' && p._id && String(p._id) !== String(user?._id)) {
                            recentUsersMap.set(p._id, p);
                        }
                    });
                }
            });
            setSearchUsers(Array.from(recentUsersMap.values()));
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await api.get(`/users?search=${encodeURIComponent(userSearchQuery)}`);
                setSearchUsers(data.users || []);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [userSearchQuery, chats, user?._id]);

    useEffect(() => {
        if (!showJoinGroup) {
            setInvitePreview(null);
            setIsLoadingInvitePreview(false);
            return undefined;
        }

        const inviteCode = extractInviteCode(inviteCodeInput);
        if (!inviteCode) {
            setInvitePreview(null);
            setIsLoadingInvitePreview(false);
            return undefined;
        }

        const timer = setTimeout(async () => {
            setIsLoadingInvitePreview(true);
            try {
                const invite = await getInviteInfo(inviteCode, { silent: true });
                setInvitePreview(invite);
            } catch (error) {
                setInvitePreview(null);
            } finally {
                setIsLoadingInvitePreview(false);
            }
        }, 280);

        return () => clearTimeout(timer);
    }, [showJoinGroup, inviteCodeInput, getInviteInfo]);

    const handleStartChat = async (userId) => {
        try {
            await createChat(userId);
            closeCreationPanels();
            toast.success('Chat started!');
        } catch {
            toast.error('Failed to start chat');
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error('Group name is required');
            return;
        }
        if (selectedUsers.length < 2) {
            toast.error('Select at least 2 members');
            return;
        }

        try {
            await api.post('/chats/group', {
                name: groupName,
                participants: selectedUsers.map(u => u._id)
            });
            closeCreationPanels();
            fetchChats(); // Refresh list
            toast.success('Group created!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create group');
        }
    };
    const handleJoinGroup = async () => {
        const inviteCode = extractInviteCode(inviteCodeInput);
        if (!inviteCode) {
            toast.error('Paste a valid invite code or link');
            return;
        }

        try {
            await joinGroupViaInvite(inviteCode);
            closeCreationPanels();
        } catch (error) {
            console.error('Join group error:', error);
        }
    };

    const toggleUserSelection = (user) => {
        if (selectedUsers.find(u => u._id === user._id)) {
            setSelectedUsers(prev => prev.filter(u => u._id !== user._id));
        } else {
            setSelectedUsers(prev => [...prev, user]);
        }
    };

    const handleToggleContact = async (targetUser) => {
        try {
            if (targetUser.isContact) {
                await removeContact(targetUser._id);
                setSearchUsers((prev) => prev.map((entry) => entry._id === targetUser._id ? { ...entry, isContact: false } : entry));
                toast.success('Contact removed');
            } else {
                await addContact(targetUser._id);
                setSearchUsers((prev) => prev.map((entry) => entry._id === targetUser._id ? { ...entry, isContact: true } : entry));
                toast.success('Contact saved');
            }
            fetchStatuses();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleOpenStatusGroup = (group, isOwn = false) => {
        setActiveStatusUserId(group?.user?._id || null);
        setIsOwnStatusGroup(isOwn);
    };

    const handleOpenCollections = async () => {
        setShowCollections(true);
        fetchBookmarkCollections().catch(() => { });
    };

    const handleOpenReminders = async () => {
        setShowReminders(true);
        fetchReminders().catch(() => { });
    };

    const handleOpenBookmarkedChat = async (message) => {
        const chatId = message?.chatId?._id || message?.chatId;
        const targetChat = (chats || []).find((entry) => `${entry._id}` === `${chatId}`);
        if (!targetChat) {
            toast.error('Open this chat from your inbox first');
            return;
        }

        await setActiveChat(targetChat);
        setShowCollections(false);
    };

    const handleOpenReminderChat = async (reminder) => {
        const chatId = reminder?.messageId?.chatId?._id || reminder?.messageId?.chatId;
        const targetChat = (chats || []).find((entry) => `${entry._id}` === `${chatId}`);
        if (!targetChat) {
            toast.error('Open this chat from your inbox first');
            return;
        }

        await setActiveChat(targetChat);
        setShowReminders(false);
    };

    const getReminderPreview = (message) => {
        if (!message) return 'Reminder';
        if (message.isDeleted) return 'Deleted message';
        if (message.viewOnce?.enabled) return message.type === 'video' ? 'View once video' : 'View once photo';
        if (message.type === 'poll') return message.poll?.question || 'Poll reminder';
        if (message.type === 'image') return message.text || 'Photo';
        if (message.type === 'video') return message.text || 'Video';
        if (message.type === 'audio') return 'Voice message';
        if (message.type === 'document') return message.fileName || message.text || 'Document';
        return message.text || 'Message reminder';
    };

    const persistFolders = async (nextFolders, successMessage) => {
        try {
            const savedFolders = await saveChatFolders(nextFolders);
            if (successMessage) {
                toast.success(successMessage);
            }

            if (savedFolders.length > 0 && !savedFolders.some((folder) => folder.folderId === activeFolderId)) {
                setActiveFolderId(savedFolders[0].folderId);
            }

            if (savedFolders.length === 0) {
                setActiveFolderId('');
                if (chatFilter.startsWith('folder:')) {
                    setChatFilter('all');
                }
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleCreateFolder = async () => {
        const normalizedNewFolderName = newFolderName.trim();
        if (!normalizedNewFolderName) {
            toast.error('Folder name is required');
            return;
        }

        const folderId = globalThis.crypto?.randomUUID?.() || `folder-${Date.now()}`;
        const nextFolders = [
            ...chatFolders,
            {
                folderId,
                name: normalizedNewFolderName,
                color: newFolderColor,
                chatIds: [],
            },
        ];

        await persistFolders(nextFolders, 'Folder created');
        setActiveFolderId(folderId);
        setNewFolderName('');
        setNewFolderColor('#6f6bff');
    };

    const handleSaveFolderMeta = async () => {
        if (!activeFolder) return;

        const normalizedName = folderDraftName.trim();
        if (!normalizedName) {
            toast.error('Folder name is required');
            return;
        }

        const nextFolders = chatFolders.map((folder) =>
            folder.folderId === activeFolder.folderId
                ? { ...folder, name: normalizedName, color: folderDraftColor }
                : folder
        );

        await persistFolders(nextFolders, 'Folder updated');
    };

    const handleDeleteFolder = async (folderId) => {
        const nextFolders = chatFolders.filter((folder) => folder.folderId !== folderId);
        await persistFolders(nextFolders, 'Folder deleted');
    };

    const handleToggleChatInFolder = async (folderId, chatId) => {
        const nextFolders = chatFolders.map((folder) => {
            if (folder.folderId !== folderId) return folder;
            const hasChat = (folder.chatIds || []).some((id) => `${id}` === `${chatId}`);
            return {
                ...folder,
                chatIds: hasChat
                    ? (folder.chatIds || []).filter((id) => `${id}` !== `${chatId}`)
                    : [...(folder.chatIds || []), chatId],
            };
        });

        await persistFolders(nextFolders, 'Folder membership updated');
    };

    const activeStatusGroup = activeStatusUserId
        ? (isOwnStatusGroup
            ? myStatuses
            : statuses.find((group) => group.user._id === activeStatusUserId) || null)
        : null;

    return (
        <>
        <div className="w-full h-full min-w-0 flex flex-col glass-panel surface-elevated overflow-hidden">
            {/* Header */}
            <div className="p-3.5 sm:p-5 flex items-center justify-between gap-3 flex-shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        onClick={onProfileClick}
                        className="w-11 h-11 rounded-full overflow-hidden cursor-pointer ring-[2.5px] ring-primary-500/40 hover:ring-primary-500/70 transition-all shadow-[0_8px_24px_rgba(124,109,255,0.22)]"
                    >
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <AvatarFallback name={user?.name} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-sm truncate tracking-tight">{user?.name}</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.6)' }} />
                            <p className="text-[11px] opacity-45 truncate">Personal workspace</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={onProfileClick}
                        className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                        title="Settings"
                    >
                        <Settings className="w-4 h-4 opacity-60" />
                    </button>
                    <ThemeToggle />
                    <button
                        onClick={() => {
                            const shouldOpen = !(showNewChat || showNewGroup || showJoinGroup);
                            if (!shouldOpen) { closeCreationPanels(); return; }
                            setShowNewChat(true); setShowNewGroup(false); setShowJoinGroup(false);
                        }}
                        className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                        title="New Chat"
                    >
                        <Plus className="w-4 h-4 opacity-65" />
                    </button>
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="icon-button hover:!border-red-400/20 hover:!bg-red-500/10 !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4 opacity-55 hover:text-red-400" />
                    </button>
                </div>
            </div>

            {/* Scrollable upper content: search + status strip + new chat panel */}
            <div className="flex-shrink min-h-0 overflow-y-auto">
            {/* Search chats */}
            <div className="px-3.5 sm:px-5 py-3.5 sm:py-4 space-y-4">
                <div className="surface-muted p-3 sm:p-3.5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] opacity-35 mb-1">Inbox</p>
                            <h3 className="text-lg font-semibold leading-none">Conversations</h3>
                        </div>
                        <span className="badge-pill shrink-0"><Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Synced live</span><span className="sm:hidden">Live</span></span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats, people, links..."
                            className="input-glass pl-10 py-2.5 text-sm"
                        />
                    </div>
                    <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar">
                        {[
                            ['all', 'All'],
                            ['unread', 'Unread'],
                            ['groups', 'Groups'],
                            ['pinned', 'Pinned'],
                            ['archived', 'Archived'],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setChatFilter(value)}
                                className={`badge-pill whitespace-nowrap transition-all text-[11px] font-semibold ${chatFilter === value ? '!text-white shadow-[0_8px_20px_rgba(124,109,255,0.30)]' : 'hover:opacity-80'}`}
                                style={chatFilter === value ? { background: 'var(--gradient-primary)', borderColor: 'transparent' } : undefined}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {chatFolders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/6">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-[11px] uppercase tracking-[0.24em] opacity-35 font-semibold">Folders</p>
                                <button
                                    onClick={() => setShowFolderManager((current) => !current)}
                                    className="text-xs text-primary-300 hover:text-primary-200 transition-colors"
                                >
                                    {showFolderManager ? 'Close' : 'Manage'}
                                </button>
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                {chatFolders.map((folder) => (
                                    <button
                                        key={folder.folderId}
                                        onClick={() => {
                                            setActiveFolderId(folder.folderId);
                                            setChatFilter(`folder:${folder.folderId}`);
                                        }}
                                        className={`badge-pill whitespace-nowrap transition-all ${chatFilter === `folder:${folder.folderId}` ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''}`}
                                        style={chatFilter === `folder:${folder.folderId}`
                                            ? { background: 'var(--gradient-primary)' }
                                            : { borderColor: `${folder.color}33`, color: folder.color }}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                                        {folder.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {(showFolderManager || chatFolders.length === 0) && (
                    <div className="glass-card rounded-[24px] p-4 animate-slide-up">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <p className="text-sm font-semibold">Chat folders</p>
                                <p className="text-xs opacity-45">Create focused inboxes for work, family, priority chats, or anything else.</p>
                            </div>
                            {chatFolders.length > 0 && (
                                <button
                                    onClick={() => setShowFolderManager((current) => !current)}
                                    className="p-2 rounded-xl hover:bg-white/5"
                                >
                                    <X className="w-4 h-4 opacity-55" />
                                </button>
                            )}
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/5 p-3 mb-3">
                            <label className="text-xs opacity-50 block mb-1">New folder</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(event) => setNewFolderName(event.target.value)}
                                    placeholder="Priority, Work, Family..."
                                    className="input-glass py-2 text-sm"
                                />
                                <div className="flex items-center gap-2">
                                    {folderColorOptions.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewFolderColor(color)}
                                            className={`w-8 h-8 rounded-full border-2 transition-transform ${newFolderColor === color ? 'scale-110 border-white/70' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <button
                                        onClick={handleCreateFolder}
                                        className="btn-primary px-3 py-2 text-sm whitespace-nowrap"
                                    >
                                        <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Create</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {chatFolders.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {chatFolders.map((folder) => (
                                        <button
                                            key={folder.folderId}
                                            onClick={() => setActiveFolderId(folder.folderId)}
                                            className={`badge-pill whitespace-nowrap transition-all ${activeFolderId === folder.folderId ? 'text-white shadow-[0_10px_22px_rgba(111,107,255,0.24)]' : ''}`}
                                            style={activeFolderId === folder.folderId
                                                ? { background: 'var(--gradient-primary)' }
                                                : { borderColor: `${folder.color}33`, color: folder.color }}
                                        >
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                                            {folder.name}
                                        </button>
                                    ))}
                                </div>

                                {activeFolder && (
                                    <div className="rounded-2xl border border-white/8 bg-white/5 p-3 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                                            <input
                                                type="text"
                                                value={folderDraftName}
                                                onChange={(event) => setFolderDraftName(event.target.value)}
                                                placeholder="Folder name"
                                                className="input-glass py-2 text-sm"
                                            />
                                            <button
                                                onClick={handleSaveFolderMeta}
                                                className="btn-glass px-3 py-2 text-sm whitespace-nowrap"
                                            >
                                                Save folder
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {folderColorOptions.map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => setFolderDraftColor(color)}
                                                        className={`w-7 h-7 rounded-full border-2 transition-transform ${folderDraftColor === color ? 'scale-110 border-white/70' : 'border-transparent'}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteFolder(activeFolder.folderId)}
                                                className="p-2 rounded-xl hover:bg-red-500/10 text-red-300"
                                                title="Delete folder"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div>
                                            <p className="text-xs opacity-45 mb-2">Assign chats</p>
                                            <div className="max-h-48 overflow-y-auto space-y-2">
                                                {(chats || []).map((chat) => {
                                                    const isAssigned = (activeFolder.chatIds || []).some((id) => `${id}` === `${chat._id}`);
                                                    return (
                                                        <button
                                                            key={chat._id}
                                                            type="button"
                                                            onClick={() => handleToggleChatInFolder(activeFolder.folderId, chat._id)}
                                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${isAssigned ? 'border-primary-400/30 bg-primary-500/10' : 'border-white/8 bg-white/5 hover:bg-white/8'}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">{formatFolderChatLabel(chat)}</p>
                                                                    <p className="text-xs opacity-45 truncate">
                                                                        {chat.isSavedMessages ? 'Personal cloud' : chat.isGroup ? `${(chat.participants || []).filter(Boolean).length} members` : 'Direct chat'}
                                                                    </p>
                                                                </div>
                                                                {isAssigned && <Check className="w-4 h-4 text-primary-300 flex-shrink-0" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                {(chats || []).length === 0 && (
                                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm opacity-55">
                                                        Chats will appear here once you have conversations to organize.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    <button
                        onClick={openSavedMessages}
                        className="w-full flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 px-4 py-3 text-left transition-all hover:bg-white/8 hover:border-primary-400/20"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-[0_14px_30px_rgba(111,107,255,0.22)]"
                                style={{ background: 'var(--gradient-primary)' }}>
                                <Bookmark className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">Saved Messages</p>
                                <p className="text-xs opacity-45 truncate">Your private space for notes, links, and forwards</p>
                            </div>
                        </div>
                        <span className="badge-pill">Personal</span>
                    </button>

                    <button
                        onClick={handleOpenCollections}
                        className="w-full flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 px-4 py-3 text-left transition-all hover:bg-white/8 hover:border-primary-400/20"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-[0_14px_30px_rgba(16,185,129,0.2)] bg-emerald-500/80">
                                <Bookmark className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">Collections</p>
                                <p className="text-xs opacity-45 truncate">Organized bookmarks for references, ideas, and important threads</p>
                            </div>
                        </div>
                        <span className="badge-pill">{bookmarkCollections.length}</span>
                    </button>

                    <button
                        onClick={handleOpenReminders}
                        className="w-full flex items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 px-4 py-3 text-left transition-all hover:bg-white/8 hover:border-primary-400/20"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-[0_14px_30px_rgba(59,130,246,0.2)] bg-sky-500/80">
                                <BellRing className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">Reminders</p>
                                <p className="text-xs opacity-45 truncate">Follow-ups, revisit later, and time-based nudges</p>
                            </div>
                        </div>
                        <span className="badge-pill">{reminders.length}</span>
                    </button>
                </div>
            </div>

            <StatusStrip
                user={user}
                myStatuses={myStatuses}
                statuses={statuses}
                isLoading={isLoadingStatuses}
                onCreate={() => setShowStatusComposer(true)}
                onOpenGroup={handleOpenStatusGroup}
            />

            </div> {/* end scrollable upper content */}

            {/* New Chat / Group Panel */}
            {(showNewChat || showNewGroup || showJoinGroup) && (
                <div className="px-3.5 sm:px-5 pb-4 flex-shrink-0 animate-slide-up">
                    <div className="glass-card p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                {showNewGroup ? <Users className="w-4 h-4 text-primary-400" /> : showJoinGroup ? <Link2 className="w-4 h-4 text-primary-400" /> : <MessageCircle className="w-4 h-4 text-primary-400" />}
                                {showNewGroup ? 'New Group' : showJoinGroup ? 'Join Group' : 'New Chat'}
                            </h3>
                            <div className="flex gap-2">
                                {!showNewGroup && !showJoinGroup && (
                                    <button
                                        onClick={() => { setShowNewGroup(true); setShowNewChat(false); setShowJoinGroup(false); }}
                                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                                    >
                                        Create Group
                                    </button>
                                )}
                                {!showJoinGroup && (
                                    <button
                                        onClick={() => { setShowJoinGroup(true); setShowNewChat(false); setShowNewGroup(false); }}
                                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                                    >
                                        Join Group
                                    </button>
                                )}
                                {!showNewChat && !showNewGroup && (
                                    <button
                                        onClick={() => { setShowNewChat(true); setShowNewGroup(false); setShowJoinGroup(false); }}
                                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                                    >
                                        New Chat
                                    </button>
                                )}
                                <button onClick={closeCreationPanels}>
                                    <X className="w-4 h-4 opacity-40 hover:opacity-80" />
                                </button>
                            </div>
                        </div>

                        {showJoinGroup ? (
                            <div className="space-y-3">
                                <p className="text-xs opacity-50">
                                    Paste a Vibely invite link or just the invite code to preview the group before joining.
                                </p>
                                <input
                                    type="text"
                                    value={inviteCodeInput}
                                    onChange={(e) => setInviteCodeInput(e.target.value)}
                                    placeholder="Paste invite link or code..."
                                    className="input-glass py-2 text-sm w-full"
                                    autoFocus
                                />
                                {isLoadingInvitePreview && (
                                    <p className="text-[11px] opacity-40">Checking invite…</p>
                                )}
                                {invitePreview && (
                                    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                {invitePreview.groupAvatar ? (
                                                    <img src={invitePreview.groupAvatar} alt={invitePreview.groupName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <AvatarFallback name={invitePreview.groupName} className="text-sm" variant="group" icon={<Users className="w-5 h-5" />} />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{invitePreview.groupName}</p>
                                                <p className="text-xs opacity-45 truncate">
                                                    {invitePreview.memberCount} members
                                                    {invitePreview.groupAdmin?.name ? ` • Admin: ${invitePreview.groupAdmin.name}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {invitePreview.joinApprovalEnabled && (
                                                <span className="badge-pill">Approval required</span>
                                            )}
                                            {invitePreview.alreadyJoined && (
                                                <span className="badge-pill !bg-primary-500/15 !text-primary-200">Already joined</span>
                                            )}
                                            {invitePreview.pendingRequest && (
                                                <span className="badge-pill !bg-amber-500/10 !text-amber-200">Request pending</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={handleJoinGroup}
                                    className="w-full btn-primary px-4 py-2.5 text-sm"
                                >
                                    {invitePreview?.alreadyJoined ? 'Open Group' : invitePreview?.pendingRequest ? 'Check Request' : 'Join Group'}
                                </button>
                            </div>
                        ) : (
                            <>
                        {showNewGroup && (
                            <div className="mb-3">
                                <label className="text-xs opacity-50 block mb-1">Group Name</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Enter group name..."
                                    className="input-glass py-2 text-sm w-full mb-2"
                                />
                                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                                    {selectedUsers.map(u => (
                                        <div key={u._id} className="flex items-center gap-1 bg-primary-500/20 px-2 py-1 rounded-full text-xs whitespace-nowrap">
                                            <span>{u.name}</span>
                                            <button onClick={() => toggleUserSelection(u)}><X className="w-3 h-3 hover:text-red-400" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            placeholder="Search by username..."
                            className="input-glass py-2 text-sm mb-2"
                            autoFocus
                        />

                        {isSearching && (
                            <p className="text-[11px] opacity-40 mb-2">Searching users...</p>
                        )}

                        <div className="max-h-56 overflow-y-auto space-y-1">
                            {searchUsers.map((u) => {
                                const isSelected = selectedUsers.find(sel => sel._id === u._id);
                                return (
                                    <div
                                        key={u._id}
                                        className={`w-full flex items-center gap-2 sm:gap-3 p-2 rounded-xl transition-colors text-left ${isSelected ? 'bg-primary-500/20' : 'hover:bg-white/5'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => showNewGroup ? toggleUserSelection(u) : handleStartChat(u._id)}
                                            className="flex items-center gap-3 text-left flex-1 min-w-0"
                                        >
                                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <AvatarFallback name={u.name} className="text-sm" />
                                                )}
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-primary-500/60 flex items-center justify-center">
                                                        <Check className="w-5 h-5 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{u.name}</p>
                                                <p className="text-xs opacity-40 truncate">@{u.username}</p>
                                            </div>
                                        </button>
                                        {!showNewGroup && (
                                            <button
                                                type="button"
                                                onClick={() => handleToggleContact(u)}
                                                className="p-2 rounded-lg hover:bg-white/10 flex-shrink-0"
                                                title={u.isContact ? 'Remove contact' : 'Add contact'}
                                            >
                                                {u.isContact ? <UserRoundMinus className="w-4 h-4 text-red-300" /> : <UserRoundPlus className="w-4 h-4 text-primary-300" />}
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {showNewGroup && (
                            <button
                                onClick={handleCreateGroup}
                                className="w-full mt-3 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white text-sm font-medium transition-colors"
                            >
                                Create Group ({selectedUsers.length})
                            </button>
                        )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 pb-3">
                <ChatList filterMode={chatFilter} />
            </div>

            {showStatusComposer && (
                <StatusComposerModal onClose={() => setShowStatusComposer(false)} />
            )}

            {activeStatusGroup && createPortal(
                <StatusViewer
                    group={activeStatusGroup}
                    isOwn={isOwnStatusGroup}
                    onClose={() => setActiveStatusUserId(null)}
                />,
                document.body
            )}

            {showCollections && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={() => setShowCollections(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-3xl glass-panel rounded-[32px] border border-white/10 p-4 sm:p-5 max-h-[85dvh] overflow-hidden animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-base font-semibold">Bookmark Collections</h3>
                                <p className="text-xs opacity-45 mt-1">Browse saved references, idea boards, and important messages across your chats.</p>
                            </div>
                            <button onClick={() => setShowCollections(false)} className="p-2 rounded-xl hover:bg-white/5">
                                <X className="w-4 h-4 opacity-60" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 max-h-[70dvh]">
                            <div className="space-y-2 overflow-y-auto pr-1">
                                {bookmarkCollections.map((collection) => (
                                    <div key={collection._id} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: collection.color || '#6f6bff' }} />
                                            <p className="text-sm font-semibold truncate">{collection.name}</p>
                                        </div>
                                        <p className="text-xs opacity-45 mt-1">
                                            {(collection.items || []).length} item{(collection.items || []).length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                ))}
                                {!isLoadingBookmarkCollections && bookmarkCollections.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm opacity-55">
                                        Save a message into a collection to see it here.
                                    </div>
                                )}
                            </div>

                            <div className="overflow-y-auto space-y-4 pr-1">
                                {isLoadingBookmarkCollections ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    bookmarkCollections.map((collection) => (
                                        <section key={collection._id} className="glass-card rounded-3xl p-4 sm:p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: collection.color || '#6f6bff' }} />
                                                <h4 className="font-semibold text-sm">{collection.name}</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {(collection.items || []).map((item) => (
                                                    <button
                                                        key={`${collection._id}-${item.messageId?._id || item.messageId}`}
                                                        onClick={() => handleOpenBookmarkedChat(item.messageId)}
                                                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-left hover:bg-white/8 transition-colors"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 mb-1">
                                                            <p className="text-sm font-semibold truncate">
                                                                {item.messageId?.senderId?.name || 'Saved message'}
                                                            </p>
                                                            <span className="text-[11px] opacity-40 whitespace-nowrap">
                                                                {new Date(item.addedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs opacity-55 truncate">
                                                            {getBookmarkedMessagePreview(item.messageId)}
                                                        </p>
                                                    </button>
                                                ))}
                                                {(collection.items || []).length === 0 && (
                                                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-sm opacity-55">
                                                        This collection is empty right now.
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReminders && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={() => setShowReminders(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-2xl glass-panel rounded-[32px] border border-white/10 p-4 sm:p-5 max-h-[85dvh] overflow-hidden animate-slide-up"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-base font-semibold">Reminders</h3>
                                <p className="text-xs opacity-45 mt-1">Timed nudges for messages you want to revisit later.</p>
                            </div>
                            <button onClick={() => setShowReminders(false)} className="p-2 rounded-xl hover:bg-white/5">
                                <X className="w-4 h-4 opacity-60" />
                            </button>
                        </div>

                        <div className="max-h-[70dvh] overflow-y-auto space-y-3 pr-1">
                            {isLoadingReminders ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                                </div>
                            ) : reminders.length > 0 ? (
                                reminders.map((reminder) => (
                                    <div key={reminder._id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <button
                                                onClick={() => handleOpenReminderChat(reminder)}
                                                className="min-w-0 flex-1 text-left"
                                            >
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <p className="text-sm font-semibold truncate">
                                                        {reminder.messageId?.senderId?.name || 'Message reminder'}
                                                    </p>
                                                    <span className={`badge-pill ${reminder.status === 'triggered' ? '!bg-primary-500/15 !text-primary-200' : ''}`}>
                                                        {reminder.status === 'triggered' ? 'Due now' : 'Scheduled'}
                                                    </span>
                                                </div>
                                                <p className="text-xs opacity-55 truncate mb-2">
                                                    {getReminderPreview(reminder.messageId)}
                                                </p>
                                                <p className="text-[11px] opacity-40">
                                                    {new Date(reminder.status === 'triggered' ? (reminder.triggeredAt || reminder.remindAt) : reminder.remindAt).toLocaleString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </button>
                                            <button
                                                onClick={() => deleteReminder(reminder._id)}
                                                className="p-2 rounded-xl hover:bg-red-500/10 text-red-300 flex-shrink-0"
                                                title="Remove reminder"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm opacity-55">
                                    Add a reminder from any message bubble to see it here.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                    style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.55)' }}
                    onClick={() => setShowLogoutConfirm(false)}
                >
                    <div
                        className="relative w-full max-w-sm rounded-[28px] border border-white/10 p-6 shadow-2xl animate-slide-up"
                        style={{ background: 'var(--surface-elevated, rgba(22,22,35,0.96))' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="flex justify-center mb-5">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.25)' }}>
                                <LogOut className="w-7 h-7 text-red-400" />
                            </div>
                        </div>

                        {/* Text */}
                        <div className="text-center mb-6">
                            <h3 className="text-base font-bold tracking-tight mb-1.5">Log out of Vibely?</h3>
                            <p className="text-sm opacity-50 leading-relaxed">You will be signed out of your account on this device. Your messages and data will remain safe.</p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => { logout(); setShowLogoutConfirm(false); }}
                                className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 24px rgba(239,68,68,0.3)' }}
                            >
                                Yes, Log Out
                            </button>
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all hover:bg-white/8 active:scale-[0.98] border border-white/10"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
