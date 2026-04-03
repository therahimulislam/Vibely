// client/src/components/chat/ChatList.jsx
// Chat list showing all conversations

import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import ChatItem from './ChatItem';
import { MessageCircle } from 'lucide-react';
import { getDisplayName } from '../../utils/userDisplay';

function ChatSection({ title, count, children }) {
    if (!children) return null;

    return (
        <section className="space-y-2">
            <div className="px-2 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.24em] opacity-35 font-semibold">{title}</p>
                <span className="badge-pill">{count}</span>
            </div>
            <div className="space-y-1">{children}</div>
        </section>
    );
}

export default function ChatList({ filterMode = 'all', showSavedMessages = true }) {
    const { chats, activeChat, setActiveChat, searchQuery, isLoadingChats, onlineUsers, typingUsers } = useChatStore();
    const { user } = useAuthStore();
    const chatFolders = Array.isArray(user?.preferences?.chatFolders) ? user.preferences.chatFolders : [];
    const chatDrafts = Array.isArray(user?.preferences?.chatDrafts) ? user.preferences.chatDrafts : [];

    if (!user?._id) {
        return (
            <div className="flex items-center justify-center py-12 text-sm opacity-50">
                Loading conversations...
            </div>
        );
    }
    const isArchivedChat = (chat) => chat.archivedBy?.some((id) => String(id) === String(user?._id));
    const activeFolderId = filterMode.startsWith('folder:') ? filterMode.slice('folder:'.length) : '';
    const activeFolder = chatFolders.find((folder) => folder.folderId === activeFolderId) || null;
    const getFoldersForChat = (chatId) => chatFolders.filter((folder) =>
        (folder.chatIds || []).some((id) => String(id) === String(chatId))
    );
    const getDraftTextForChat = (chatId) =>
        chatDrafts.find((entry) => `${entry.chatId}` === `${chatId}`)?.text || '';

    // Filter chats based on search
    const safeChats = Array.isArray(chats) ? chats : [];
    const filteredBySearch = searchQuery
        ? safeChats.filter((chat) => {
            const normalizedQuery = searchQuery.toLowerCase();
            if (chat.isSavedMessages) {
                return 'saved messages'.includes(normalizedQuery) || 'personal cloud'.includes(normalizedQuery);
            }
            if (chat.isGroup) {
                return `${chat.groupName || 'group chat'}`.toLowerCase().includes(normalizedQuery);
            }
            const validParticipants = (chat.participants || []).filter(p => p);
            return validParticipants.some(
                (p) => p._id !== user._id && (
                    getDisplayName(p, user).toLowerCase().includes(normalizedQuery)
                    || `${p.name || ''}`.toLowerCase().includes(normalizedQuery)
                    || `${p.username || ''}`.toLowerCase().includes(normalizedQuery)
                )
            );
        })
        : safeChats;

    const filteredChats = filteredBySearch.filter((chat) => {
        const archived = isArchivedChat(chat);
        const matchesFolder = !activeFolderId || getFoldersForChat(chat._id).some((folder) => folder.folderId === activeFolderId);

        if (!showSavedMessages && chat.isSavedMessages) {
            return false;
        }

        if (activeFolderId) {
            return matchesFolder;
        }

        if (filterMode === 'archived') {
            return archived;
        }
        if (archived) {
            return false;
        }
        if (filterMode === 'unread') {
            return (chat.unreadCount?.[user._id] || 0) > 0;
        }
        if (filterMode === 'groups') {
            return !!chat.isGroup;
        }
        if (filterMode === 'all' && chat.isSavedMessages) {
            return true;
        }
        if (filterMode === 'pinned') {
            return chat.pinnedBy?.includes(user._id);
        }
        return true;
    });

    // Sort: newest first inside each section
    const sortedChats = [...filteredChats].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    const pinnedChats = sortedChats.filter((chat) => chat.pinnedBy?.includes(user._id));
    const recentChats = sortedChats.filter((chat) => !chat.pinnedBy?.includes(user._id));

    if (isLoadingChats) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
            </div>
        );
    }

    if (sortedChats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <MessageCircle className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm opacity-40 text-center">
                    {searchQuery
                        ? 'No conversations found'
                        : activeFolder
                            ? `No chats in ${activeFolder.name} yet`
                            : filterMode === 'archived'
                                ? 'No archived chats yet'
                                : 'No conversations yet'}
                </p>
                <p className="text-xs opacity-30 text-center mt-1">
                    {activeFolder ? 'Assign chats to this folder from the folder manager.' : 'Start a new chat using the + button above'}
                </p>
            </div>
        );
    }

    const renderChat = (chat) => {
        let displayUser;
        let isOnline = false;

        if (chat.isSavedMessages) {
            displayUser = {
                _id: chat._id,
                name: 'Saved Messages',
                avatar: '',
                isSavedMessages: true,
            };
        } else if (chat.isGroup) {
            displayUser = {
                _id: chat._id,
                name: chat.groupName,
                avatar: chat.groupAvatar,
                isGroup: true
            };
        } else {
            const validParticipants = (chat.participants || []).filter(p => p);
            const participant = validParticipants.find((p) => p._id !== user._id);
            displayUser = participant
                ? {
                    ...participant,
                    originalName: participant.name,
                    name: getDisplayName(participant, user),
                }
                : null;
            if (!displayUser) return null;
            isOnline = onlineUsers instanceof Set ? onlineUsers.has(displayUser._id) : !!displayUser.isOnline;
        }

        const isTyping = typingUsers?.[chat._id];
        const unread = chat.unreadCount?.[user._id] || 0;
        const isPinned = chat.pinnedBy?.includes(user._id);
        const chatFolder = getFoldersForChat(chat._id)[0] || null;
        const draftText = getDraftTextForChat(chat._id);

        return (
            <ChatItem
                key={chat._id}
                chat={chat}
                displayUser={displayUser}
                isActive={activeChat?._id === chat._id}
                isOnline={isOnline}
                isTyping={!!isTyping}
                unreadCount={unread}
                isPinned={isPinned}
                folderLabel={chatFolder?.name || ''}
                folderColor={chatFolder?.color || ''}
                draftText={draftText}
                currentUserId={user?._id}
                onClick={() => setActiveChat(chat)}
            />
        );
    };

    return (
        <div className="px-2 py-2 space-y-4">
            {pinnedChats.length > 0 && (
                <ChatSection title="Pinned" count={pinnedChats.length}>
                    {pinnedChats.map(renderChat)}
                </ChatSection>
            )}

            {recentChats.length > 0 && (
                <ChatSection title={pinnedChats.length > 0 ? 'Recent' : 'Chats'} count={recentChats.length}>
                    {recentChats.map(renderChat)}
                </ChatSection>
            )}
        </div>
    );
}
