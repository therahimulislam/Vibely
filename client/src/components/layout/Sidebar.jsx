// client/src/components/layout/Sidebar.jsx
// Left sidebar with header, search, chat list, and new chat

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Settings, LogOut, Sun, Moon, MessageCircle, X, Users, UserPlus, Check, UserRoundPlus, UserRoundMinus } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useStatusStore from '../../store/useStatusStore';
import ChatList from '../chat/ChatList';
import StatusStrip from '../status/StatusStrip';
import StatusComposerModal from '../status/StatusComposerModal';
import StatusViewer from '../status/StatusViewer';
import SearchBar from '../ui/SearchBar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function Sidebar({ onProfileClick }) {
    const navigate = useNavigate();
    const { user, logout, addContact, removeContact } = useAuthStore();
    const { searchQuery, setSearchQuery, createChat, fetchChats, error } = useChatStore();
    const { myStatuses, statuses, fetchStatuses, isLoading: isLoadingStatuses } = useStatusStore();
    const [showNewChat, setShowNewChat] = useState(false);
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showStatusComposer, setShowStatusComposer] = useState(false);
    const [isOwnStatusGroup, setIsOwnStatusGroup] = useState(false);
    const [activeStatusUserId, setActiveStatusUserId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchUsers, setSearchUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const isDark = document.documentElement.classList.contains('dark');

    // Display store errors
    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    // Search users for new chat
    useEffect(() => {
        if (!userSearchQuery.trim()) {
            setSearchUsers([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await api.get(`/users?search=${encodeURIComponent(userSearchQuery)}`);
                setSearchUsers(data.users);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [userSearchQuery]);

    const handleStartChat = async (userId) => {
        try {
            await createChat(userId);
            setShowNewChat(false);
            setUserSearchQuery('');
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
            setShowNewGroup(false);
            setGroupName('');
            setSelectedUsers([]);
            fetchChats(); // Refresh list
            toast.success('Group created!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create group');
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

    const activeStatusGroup = activeStatusUserId
        ? (isOwnStatusGroup
            ? myStatuses
            : statuses.find((group) => group.user._id === activeStatusUserId) || null)
        : null;

    return (
        <div className="w-full h-full min-w-0 flex flex-col glass-panel border-r border-white/5 dark:border-white/5">
            {/* Header */}
            <div className="p-3 sm:p-4 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        onClick={onProfileClick}
                        className="w-10 h-10 rounded-full overflow-hidden cursor-pointer ring-2 ring-primary-500/30 hover:ring-primary-500/60 transition-all"
                    >
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold"
                                style={{ background: 'var(--gradient-primary)' }}>
                                {user?.name?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-semibold text-sm truncate">{user?.name}</h2>
                        <p className="text-xs opacity-40">Online</p>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    <button
                        onClick={() => navigate('/settings/sessions')}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5 opacity-50" />
                    </button>
                    <button
                        onClick={() => window.__toggleTheme?.()}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        title="Toggle theme"
                    >
                        {isDark ? <Sun className="w-5 h-5 opacity-50" /> : <Moon className="w-5 h-5 opacity-50" />}
                    </button>
                    <button
                        onClick={() => setShowNewChat(!showNewChat)}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors relative group"
                        title="New Chat / Group"
                    >
                        <Plus className="w-5 h-5 opacity-50" />
                    </button>
                    <button
                        onClick={logout}
                        className="p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5 opacity-50 hover:text-red-400" />
                    </button>
                </div>
            </div>

            {/* Search chats */}
            <div className="px-3 sm:px-4 pb-3 flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search conversations..."
                        className="input-glass pl-10 py-2.5 text-sm"
                    />
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

            {/* New Chat / Group Panel */}
            {(showNewChat || showNewGroup) && (
                <div className="px-3 sm:px-4 pb-3 flex-shrink-0 animate-slide-up">
                    <div className="glass-card p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                {showNewGroup ? <Users className="w-4 h-4 text-primary-400" /> : <MessageCircle className="w-4 h-4 text-primary-400" />}
                                {showNewGroup ? 'New Group' : 'New Chat'}
                            </h3>
                            <div className="flex gap-2">
                                {!showNewGroup && (
                                    <button
                                        onClick={() => { setShowNewGroup(true); setShowNewChat(false); }}
                                        className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                                    >
                                        Create Group
                                    </button>
                                )}
                                <button onClick={() => { setShowNewChat(false); setShowNewGroup(false); }}>
                                    <X className="w-4 h-4 opacity-40 hover:opacity-80" />
                                </button>
                            </div>
                        </div>

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

                        <div className="max-h-48 overflow-y-auto space-y-1">
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
                                                    <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                                                        style={{ background: 'var(--gradient-accent)' }}>
                                                        {u.name[0].toUpperCase()}
                                                    </div>
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
                    </div>
                </div>
            )}

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                <ChatList />
            </div>

            {showStatusComposer && (
                <StatusComposerModal onClose={() => setShowStatusComposer(false)} />
            )}

            {activeStatusGroup && (
                <StatusViewer
                    group={activeStatusGroup}
                    isOwn={isOwnStatusGroup}
                    onClose={() => setActiveStatusUserId(null)}
                />
            )}
        </div>
    );
}
