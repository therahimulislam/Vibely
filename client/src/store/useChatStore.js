// client/src/store/useChatStore.js
// Chat and messaging state management

import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuthStore from './useAuthStore';

const typingTimeouts = {};
const sameId = (left, right) => String(left || '') === String(right || '');
const applyPresenceToParticipants = (participants = [], onlineUsers = new Set(), fallbackLastSeen = null) =>
    (participants || []).map((participant) => {
        if (!participant) return participant;
        const isOnline = onlineUsers instanceof Set ? onlineUsers.has(participant._id) : false;
        return {
            ...participant,
            isOnline,
            lastSeen: isOnline ? participant.lastSeen : (fallbackLastSeen || participant.lastSeen),
        };
    });

const applyPresenceToChat = (chat, onlineUsers, targetUserId = null, isOnline = null, lastSeen = null) => {
    if (!chat) return chat;

    if (!targetUserId) {
        return {
            ...chat,
            participants: applyPresenceToParticipants(chat.participants, onlineUsers),
        };
    }

    return {
        ...chat,
        participants: (chat.participants || []).map((participant) => {
            if (!participant || participant._id !== targetUserId) return participant;
            return {
                ...participant,
                isOnline,
                lastSeen: isOnline ? participant.lastSeen : (lastSeen || participant.lastSeen),
            };
        }),
    };
};

const sortChatsByUpdatedAt = (chats = []) =>
    [...chats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
const sortScheduledMessagesByDate = (messages = []) =>
    [...messages].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
const sortPinnedMessagesByDate = (messages = []) =>
    [...messages].sort((a, b) => new Date(b.pinnedAt || b.createdAt) - new Date(a.pinnedAt || a.createdAt));
const sortBookmarkCollections = (collections = []) =>
    [...collections].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

const getCurrentUserId = () => useAuthStore.getState().user?._id || null;
const extractInviteCode = (value = '') =>
    `${value}`.trim().replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';

const toggleUserInIdList = (list = [], userId, enabled) => {
    if (!userId) return list || [];
    const filtered = (list || []).filter((id) => !sameId(id, userId));
    return enabled ? [...filtered, userId] : filtered;
};

const updateChatPreviewWithMessage = (chat, message) => {
    if (!chat || !message || !sameId(chat._id, message.chatId)) return chat;

    return {
        ...chat,
        lastMessage: message,
        updatedAt: message.createdAt || new Date().toISOString(),
        archivedBy: [],
    };
};

const updateChatLastMessageIfMatching = (chat, message) => {
    if (!chat || !message || !sameId(chat._id, message.chatId)) return chat;
    if (!sameId(chat.lastMessage?._id, message._id)) return chat;

    return {
        ...chat,
        lastMessage: message,
    };
};

const updateChatLastMessageOnDelete = (chat, messageId) => {
    if (!chat || !sameId(chat.lastMessage?._id, messageId)) return chat;

    return {
        ...chat,
        lastMessage: {
            ...chat.lastMessage,
            isDeleted: true,
            text: '',
            fileUrl: '',
            fileName: '',
            fileSize: 0,
        },
    };
};

const upsertChat = (chats = [], nextChat) => {
    if (!nextChat) return chats;
    const exists = chats.some((chat) => sameId(chat._id, nextChat._id));
    return sortChatsByUpdatedAt(
        exists
            ? chats.map((chat) => (sameId(chat._id, nextChat._id) ? nextChat : chat))
            : [nextChat, ...chats]
    );
};
const replaceChatEverywhere = (state, nextChat) => ({
    chats: upsertChat(state.chats, nextChat),
    activeChat: sameId(state.activeChat?._id, nextChat?._id) ? nextChat : state.activeChat,
});

const sortMessagesByCreatedAt = (messages = []) =>
    [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const useChatStore = create((set, get) => ({
    chats: [],
    activeChat: null,
    messages: [],
    replyingTo: null,
    messageSearchResults: [],
    isSearchingChatMessages: false,
    scheduledMessages: [],
    pinnedMessages: [],
    bookmarkCollections: [],
    typingUsers: {},
    onlineUsers: new Set(),
    searchQuery: '',
    isLoadingChats: false,
    isLoadingMessages: false,
    isLoadingScheduledMessages: false,
    isLoadingPinnedMessages: false,
    isLoadingBookmarkCollections: false,
    hasMoreMessages: false,
    currentPage: 1,
    error: null,

    // Fetch all chats for current user
    fetchChats: async () => {
        set({ isLoadingChats: true, error: null });
        try {
            const { data } = await api.get('/chats');
            const onlineUsers = get().onlineUsers;
            set({
                chats: (data.chats || []).map((chat) => applyPresenceToChat(chat, onlineUsers)),
                isLoadingChats: false,
            });
        } catch (error) {
            set({
                isLoadingChats: false,
                error: error.response?.data?.error || 'Failed to fetch chats'
            });
            console.error('Failed to fetch chats:', error);
        }
    },

    // Set active chat and load messages
    setActiveChat: async (chat) => {
        set({
            activeChat: chat,
            messages: [],
            replyingTo: null,
            messageSearchResults: [],
            scheduledMessages: [],
            pinnedMessages: [],
            currentPage: 1,
            hasMoreMessages: false,
            error: null,
        });
        if (chat) {
            await Promise.allSettled([
                get().fetchMessages(chat._id, 1),
                get().fetchScheduledMessages(chat._id),
                get().fetchPinnedMessages(chat._id),
            ]);
        }
    },

    // Fetch messages for a chat (paginated)
    fetchMessages: async (chatId, page = 1) => {
        set({ isLoadingMessages: true, error: null });
        try {
            const { data } = await api.get(`/messages/${chatId}?page=${page}&limit=30`);
            set((state) => ({
                messages: page === 1 ? data.messages : [...data.messages, ...state.messages],
                hasMoreMessages: data.pagination.hasMore,
                currentPage: page,
                isLoadingMessages: false,
            }));
        } catch (error) {
            set({
                isLoadingMessages: false,
                error: error.response?.data?.error || 'Failed to fetch messages'
            });
            console.error('Failed to fetch messages:', error);
        }
    },

    // Load more messages (infinite scroll)
    loadMoreMessages: async () => {
        const { activeChat, currentPage, hasMoreMessages, isLoadingMessages } = get();
        if (!activeChat || !hasMoreMessages || isLoadingMessages) return;
        await get().fetchMessages(activeChat._id, currentPage + 1);
    },

    fetchScheduledMessages: async (chatId) => {
        if (!chatId) {
            set({ scheduledMessages: [], isLoadingScheduledMessages: false });
            return [];
        }

        set({ isLoadingScheduledMessages: true });
        try {
            const { data } = await api.get(`/messages/scheduled/${chatId}`);
            const scheduledMessages = sortScheduledMessagesByDate(data.scheduledMessages || []);
            set({ scheduledMessages, isLoadingScheduledMessages: false });
            return scheduledMessages;
        } catch (error) {
            set({ isLoadingScheduledMessages: false, scheduledMessages: [] });
            console.error('Failed to fetch scheduled messages:', error);
            return [];
        }
    },

    createScheduledMessage: async (payload) => {
        try {
            const config = payload instanceof FormData
                ? { headers: { 'Content-Type': 'multipart/form-data' } }
                : undefined;
            const { data } = await api.post('/messages/scheduled', payload, config);
            set((state) => ({
                scheduledMessages: sortScheduledMessagesByDate([
                    ...state.scheduledMessages.filter((message) => !sameId(message._id, data.scheduledMessage?._id)),
                    data.scheduledMessage,
                ]),
            }));
            toast.success('Message scheduled');
            return data.scheduledMessage;
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to schedule message';
            toast.error(message);
            throw error;
        }
    },

    deleteScheduledMessage: async (scheduledMessageId) => {
        try {
            await api.delete(`/messages/scheduled/${scheduledMessageId}`);
            set((state) => ({
                scheduledMessages: state.scheduledMessages.filter((message) => !sameId(message._id, scheduledMessageId)),
            }));
            toast.success('Scheduled message removed');
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to remove scheduled message';
            toast.error(message);
            throw error;
        }
    },

    updateScheduledMessage: async (scheduledMessageId, payload) => {
        try {
            const { data } = await api.patch(`/messages/scheduled/${scheduledMessageId}`, payload);
            set((state) => ({
                scheduledMessages: sortScheduledMessagesByDate([
                    ...state.scheduledMessages.filter((message) => !sameId(message._id, scheduledMessageId)),
                    data.scheduledMessage,
                ]),
            }));
            toast.success('Scheduled message updated');
            return data.scheduledMessage;
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to update scheduled message';
            toast.error(message);
            throw error;
        }
    },

    removeScheduledMessageFromQueue: (scheduledMessageId) => {
        if (!scheduledMessageId) return;
        set((state) => ({
            scheduledMessages: state.scheduledMessages.filter((message) => !sameId(message._id, scheduledMessageId)),
        }));
    },

    fetchPinnedMessages: async (chatId) => {
        if (!chatId) {
            set({ pinnedMessages: [], isLoadingPinnedMessages: false });
            return [];
        }

        set({ isLoadingPinnedMessages: true });
        try {
            const { data } = await api.get(`/messages/pins/${chatId}`);
            const pinnedMessages = sortPinnedMessagesByDate(data.pinnedMessages || []);
            set({ pinnedMessages, isLoadingPinnedMessages: false });
            return pinnedMessages;
        } catch (error) {
            set({ isLoadingPinnedMessages: false, pinnedMessages: [] });
            console.error('Failed to fetch pinned messages:', error);
            return [];
        }
    },

    fetchBookmarkCollections: async () => {
        set({ isLoadingBookmarkCollections: true });
        try {
            const { data } = await api.get('/bookmarks');
            const bookmarkCollections = sortBookmarkCollections(data.collections || []);
            set({ bookmarkCollections, isLoadingBookmarkCollections: false });
            return bookmarkCollections;
        } catch (error) {
            set({ isLoadingBookmarkCollections: false });
            toast.error(error.response?.data?.error || 'Failed to load bookmark collections');
            throw error;
        }
    },

    createBookmarkCollection: async ({ name, color }) => {
        try {
            const { data } = await api.post('/bookmarks', { name, color });
            set((state) => ({
                bookmarkCollections: sortBookmarkCollections([
                    data.collection,
                    ...state.bookmarkCollections.filter((collection) => !sameId(collection._id, data.collection?._id)),
                ]),
            }));
            toast.success('Collection created');
            return data.collection;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create collection');
            throw error;
        }
    },

    updateBookmarkCollection: async (collectionId, payload) => {
        try {
            const { data } = await api.patch(`/bookmarks/${collectionId}`, payload);
            set((state) => ({
                bookmarkCollections: sortBookmarkCollections(
                    state.bookmarkCollections.map((collection) =>
                        sameId(collection._id, collectionId) ? data.collection : collection
                    )
                ),
            }));
            toast.success('Collection updated');
            return data.collection;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update collection');
            throw error;
        }
    },

    deleteBookmarkCollection: async (collectionId) => {
        try {
            await api.delete(`/bookmarks/${collectionId}`);
            set((state) => ({
                bookmarkCollections: state.bookmarkCollections.filter((collection) => !sameId(collection._id, collectionId)),
            }));
            toast.success('Collection deleted');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete collection');
            throw error;
        }
    },

    toggleMessageInBookmarkCollection: async (collectionId, messageId) => {
        try {
            const { data } = await api.post(`/bookmarks/${collectionId}/messages`, { messageId });
            set((state) => ({
                bookmarkCollections: sortBookmarkCollections(
                    state.bookmarkCollections.map((collection) =>
                        sameId(collection._id, collectionId) ? data.collection : collection
                    )
                ),
            }));
            toast.success(data.saved ? 'Saved to collection' : 'Removed from collection');
            return data.collection;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update collection');
            throw error;
        }
    },

    // Create or find 1-on-1 chat
    createChat: async (participantId) => {
        set({ error: null });
        try {
            const { data } = await api.post('/chats/create', { participantId });
            const hydratedChat = applyPresenceToChat(data.chat, get().onlineUsers);
            if (data.isNew) {
                set((state) => ({ chats: [hydratedChat, ...state.chats] }));
            }
            set({ activeChat: hydratedChat });
            await get().fetchMessages(hydratedChat._id, 1);
            return hydratedChat;
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to create chat';
            set({ error: msg });
            console.error('Failed to create chat:', error);
            throw error;
        }
    },

    ensureSavedMessagesChat: async () => {
        set({ error: null });
        try {
            const { data } = await api.post('/chats/saved');
            const hydratedChat = applyPresenceToChat(data.chat, get().onlineUsers);

            set((state) => ({
                chats: upsertChat(state.chats, hydratedChat),
            }));

            return hydratedChat;
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to open Saved Messages';
            set({ error: msg });
            toast.error(msg);
            throw error;
        }
    },

    openSavedMessages: async () => {
        const hydratedChat = await get().ensureSavedMessagesChat();
        set({
            activeChat: hydratedChat,
            messages: [],
            replyingTo: null,
            messageSearchResults: [],
            currentPage: 1,
            hasMoreMessages: false,
        });
        await get().fetchMessages(hydratedChat._id, 1);
        return hydratedChat;
    },

    // Add message (from socket or API)
    addMessage: (message) => {
        set((state) => {
            const existsInActiveChat = state.messages.some((m) => m._id === message._id);
            const nextMessages = state.activeChat?._id === message.chatId && !existsInActiveChat
                ? [...state.messages, message]
                : state.messages;

            const updatedChats = sortChatsByUpdatedAt(
                state.chats.map((chat) => updateChatPreviewWithMessage(chat, message))
            );

            return {
                messages: nextMessages,
                chats: updatedChats,
                activeChat: state.activeChat?._id === message.chatId
                    ? {
                        ...state.activeChat,
                        lastMessage: message,
                        updatedAt: message.createdAt || new Date().toISOString(),
                        archivedBy: [],
                    }
                    : state.activeChat,
                messageSearchResults: state.messageSearchResults.map((entry) =>
                    sameId(entry._id, message._id) ? message : entry
                ),
            };
        });
    },

    // Update message (edit, reaction, status)
    updateMessage: (updatedMessage) => {
        set((state) => {
            const shouldSyncPinnedBoard =
                sameId(state.activeChat?._id, updatedMessage.chatId) ||
                state.pinnedMessages.some((message) => sameId(message._id, updatedMessage._id));

            return {
                messages: state.messages.map((m) =>
                    m._id === updatedMessage._id ? updatedMessage : m
                ),
                messageSearchResults: state.messageSearchResults.map((m) =>
                    m._id === updatedMessage._id ? updatedMessage : m
                ),
                pinnedMessages: shouldSyncPinnedBoard
                    ? (updatedMessage.isPinned
                        ? sortPinnedMessagesByDate([
                            ...state.pinnedMessages.filter((message) => !sameId(message._id, updatedMessage._id)),
                            updatedMessage,
                        ])
                        : state.pinnedMessages.filter((message) => !sameId(message._id, updatedMessage._id)))
                    : state.pinnedMessages,
                chats: state.chats.map((chat) => updateChatLastMessageIfMatching(chat, updatedMessage)),
                activeChat: updateChatLastMessageIfMatching(state.activeChat, updatedMessage),
            };
        });
    },

    openViewOnceMessage: async (messageId) => {
        try {
            const { data } = await api.post(`/messages/${messageId}/view-once/open`);
            if (data.message) {
                get().updateMessage(data.message);
            }
            return data;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to open protected media');
            throw error;
        }
    },

    // Delete message
    removeMessage: (messageId, type = 'me') => {
        set((state) => ({
            messages: type === 'everyone'
                ? state.messages.map((m) =>
                    m._id === messageId ? { ...m, isDeleted: true, text: '', imageUrl: '', videoUrl: '' } : m
                )
                : state.messages.filter((m) => m._id !== messageId),
            messageSearchResults: type === 'everyone'
                ? state.messageSearchResults.map((m) =>
                    m._id === messageId ? { ...m, isDeleted: true, text: '', imageUrl: '', videoUrl: '' } : m
                )
                : state.messageSearchResults.filter((m) => m._id !== messageId),
            pinnedMessages: state.pinnedMessages.filter((message) => !sameId(message._id, messageId)),
            chats: type === 'everyone'
                ? state.chats.map((chat) => updateChatLastMessageOnDelete(chat, messageId))
                : state.chats,
            activeChat: type === 'everyone'
                ? updateChatLastMessageOnDelete(state.activeChat, messageId)
                : state.activeChat,
        }));
    },

    // Mark messages as seen
    markAsSeen: async (chatId) => {
        try {
            await api.patch('/messages/seen', { chatId });
        } catch (error) {
            console.error('Failed to mark as seen:', error);
        }
    },

    // Update messages seen status
    setMessagesSeen: (chatId) => {
        set((state) => ({
            messages: state.messages.map((m) =>
                m.chatId === chatId ? { ...m, status: 'seen' } : m
            ),
        }));
    },

    // Toggle pin chat
    togglePin: async (chatId) => {
        try {
            const { data } = await api.patch(`/chats/${chatId}/pin`);
            const userId = getCurrentUserId();
            set((state) => ({
                chats: state.chats.map((chat) =>
                    chat._id === chatId
                        ? { ...chat, pinnedBy: toggleUserInIdList(chat.pinnedBy, userId, data.pinned) }
                        : chat
                ),
                activeChat: state.activeChat?._id === chatId
                    ? { ...state.activeChat, pinnedBy: toggleUserInIdList(state.activeChat.pinnedBy, userId, data.pinned) }
                    : state.activeChat,
            }));
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        }
    },

    toggleArchiveChat: async (chatId) => {
        try {
            const { data } = await api.patch(`/chats/${chatId}/archive`);
            const userId = getCurrentUserId();
            set((state) => ({
                chats: state.chats.map((chat) => {
                    if (chat._id !== chatId) return chat;
                    return {
                        ...chat,
                        archivedBy: toggleUserInIdList(chat.archivedBy, userId, data.archived),
                    };
                }),
                activeChat: state.activeChat?._id === chatId
                    ? {
                        ...state.activeChat,
                        archivedBy: toggleUserInIdList(state.activeChat.archivedBy, userId, data.archived),
                    }
                    : state.activeChat,
            }));
            toast.success(data.archived ? 'Chat archived' : 'Chat moved back to inbox');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update chat archive');
        }
    },

    // Delete chat
    deleteChat: async (chatId) => {
        try {
            await api.delete(`/chats/${chatId}`);
            set((state) => ({
                chats: state.chats.filter((c) => c._id !== chatId),
                activeChat: state.activeChat?._id === chatId ? null : state.activeChat,
                messages: state.activeChat?._id === chatId ? [] : state.messages,
            }));
        } catch (error) {
            console.error('Failed to delete chat:', error);
        }
    },

    // Add user to group
    addToGroup: async (chatId, userId, username) => {
        try {
            const { data } = await api.put('/chats/group/add', { chatId, userId, username });
            set((state) => replaceChatEverywhere(state, data.chat));
            toast.success('User added to group');
        } catch (error) {
            console.error('Failed to add to group:', error);
            toast.error(error.response?.data?.error || 'Failed to add user');
        }
    },

    updateGroupSettings: async (chatId, payload) => {
        try {
            const { data } = await api.patch(`/chats/${chatId}/group-settings`, payload);
            set((state) => replaceChatEverywhere(state, data.chat));
            toast.success('Group settings updated');
            return data.chat;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update group settings');
            throw error;
        }
    },

    createInviteLink: async (chatId) => {
        try {
            const { data } = await api.post(`/chats/${chatId}/invite-links`);
            set((state) => replaceChatEverywhere(state, data.chat));
            toast.success('Invite link created');
            return data.inviteLink;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create invite link');
            throw error;
        }
    },

    revokeInviteLink: async (chatId, code) => {
        try {
            const { data } = await api.delete(`/chats/${chatId}/invite-links/${code}`);
            set((state) => replaceChatEverywhere(state, data.chat));
            toast.success('Invite link revoked');
            return data.chat;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to revoke invite link');
            throw error;
        }
    },

    getInviteInfo: async (codeOrUrl, { silent = false } = {}) => {
        try {
            const inviteCode = extractInviteCode(codeOrUrl);
            const { data } = await api.get(`/chats/invite/${inviteCode}`);
            return data.invite;
        } catch (error) {
            if (!silent) {
                toast.error(error.response?.data?.error || 'Failed to load invite');
            }
            throw error;
        }
    },

    joinGroupViaInvite: async (codeOrUrl) => {
        try {
            const inviteCode = extractInviteCode(codeOrUrl);
            const { data } = await api.post(`/chats/invite/${inviteCode}/join`);
            const currentUserId = getCurrentUserId();
            const userIsParticipant = (data.chat?.participants || []).some((participant) =>
                sameId(participant?._id || participant, currentUserId)
            );

            if (data.chat && (data.joined || userIsParticipant)) {
                set((state) => replaceChatEverywhere(state, data.chat));
            }

            if (data.joined && data.chat) {
                await get().setActiveChat(data.chat);
                toast.success('Joined group');
            } else if (data.pending) {
                toast.success('Join request sent');
            }

            return data;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to join group');
            throw error;
        }
    },

    reviewJoinRequest: async (chatId, userId, action) => {
        try {
            const { data } = await api.patch(`/chats/${chatId}/join-requests`, { userId, action });
            set((state) => replaceChatEverywhere(state, data.chat));
            toast.success(action === 'accept' ? 'Member approved' : 'Request rejected');
            return data.chat;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to review join request');
            throw error;
        }
    },

    // Typing indicators
    setTyping: (chatId, userId) => {
        if (typingTimeouts[chatId]) {
            clearTimeout(typingTimeouts[chatId]);
        }
        typingTimeouts[chatId] = setTimeout(() => {
            get().clearTyping(chatId);
        }, 3000);

        set((state) => ({
            typingUsers: { ...state.typingUsers, [chatId]: userId },
        }));
    },

    clearTyping: (chatId) => {
        if (typingTimeouts[chatId]) {
            clearTimeout(typingTimeouts[chatId]);
            delete typingTimeouts[chatId];
        }

        set((state) => {
            const { [chatId]: _, ...rest } = state.typingUsers;
            return { typingUsers: rest };
        });
    },

    // Online status
    setUserOnline: (userId) => {
        set((state) => {
            const newSet = new Set(state.onlineUsers);
            newSet.add(userId);
            return {
                onlineUsers: newSet,
                chats: state.chats.map((chat) => applyPresenceToChat(chat, newSet, userId, true)),
                activeChat: applyPresenceToChat(state.activeChat, newSet, userId, true),
            };
        });
    },

    setOnlineUsers: (userIds = []) => {
        const onlineUsers = new Set(userIds);
        set((state) => ({
            onlineUsers,
            chats: state.chats.map((chat) => applyPresenceToChat(chat, onlineUsers)),
            activeChat: applyPresenceToChat(state.activeChat, onlineUsers),
        }));
    },

    setUserOffline: (userId, lastSeen = null) => {
        set((state) => {
            const newSet = new Set(state.onlineUsers);
            newSet.delete(userId);
            return {
                onlineUsers: newSet,
                chats: state.chats.map((chat) => applyPresenceToChat(chat, newSet, userId, false, lastSeen)),
                activeChat: applyPresenceToChat(state.activeChat, newSet, userId, false, lastSeen),
            };
        });
    },

    // Search
    setSearchQuery: (query) => set({ searchQuery: query }),

    setReplyingTo: (message) => set({ replyingTo: message }),

    clearReplyingTo: () => set({ replyingTo: null }),

    searchChatMessages: async (chatId, params = {}) => {
        if (!chatId) return [];

        set({ isSearchingChatMessages: true });
        try {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && `${value}`.trim() !== '') {
                    searchParams.set(key, value);
                }
            });

            const { data } = await api.get(`/messages/${chatId}/search?${searchParams.toString()}`);
            set({ messageSearchResults: data.results || [], isSearchingChatMessages: false });
            return data.results || [];
        } catch (error) {
            set({ isSearchingChatMessages: false });
            toast.error(error.response?.data?.error || 'Failed to search messages');
            throw error;
        }
    },

    clearChatSearch: () => set({ messageSearchResults: [], isSearchingChatMessages: false }),

    insertMessageIfMissing: (message) => {
        if (!message) return;
        set((state) => {
            if (!sameId(state.activeChat?._id, message.chatId)) {
                return state;
            }

            const exists = state.messages.some((entry) => sameId(entry._id, message._id));
            if (exists) {
                return state;
            }

            return {
                messages: sortMessagesByCreatedAt([...state.messages, message]),
            };
        });
    },

    respondToRequest: async (chatId, action) => {
        try {
            const { data } = await api.patch(`/chats/${chatId}/request`, { action });
            set((state) => {
                const chats = action === 'reject'
                    ? state.chats.filter((chat) => chat._id !== chatId)
                    : state.chats.map((chat) => chat._id === chatId ? data.chat : chat);

                return {
                    chats,
                    activeChat: action === 'reject'
                        ? (state.activeChat?._id === chatId ? null : state.activeChat)
                        : (state.activeChat?._id === chatId ? data.chat : state.activeChat),
                    messages: action === 'reject' && state.activeChat?._id === chatId ? [] : state.messages,
                };
            });
            return data.chat;
        } catch (error) {
            throw error;
        }
    },

    createPoll: async (chatId, question, options) => {
        try {
            const { data } = await api.post('/messages/poll', { chatId, question, options });
            get().addMessage(data.message);
            return data.message;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create poll');
            throw error;
        }
    },

    votePoll: async (messageId, optionId) => {
        try {
            const { data } = await api.post(`/messages/poll/${messageId}/vote`, { optionId });
            get().updateMessage(data.message);
            return data.message;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to vote on poll');
            throw error;
        }
    },

    toggleStarMessage: async (messageId) => {
        try {
            const { data } = await api.post(`/messages/${messageId}/star`);
            get().updateMessage(data.message);
            toast.success(data.starred ? 'Message starred' : 'Message unstarred');
            return data.message;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update starred message');
            throw error;
        }
    },

    togglePinMessage: async (messageId) => {
        try {
            const { data } = await api.post(`/messages/${messageId}/pin`);
            get().updateMessage(data.message);
            toast.success(data.pinned ? 'Message pinned' : 'Message unpinned');
            return data.message;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update pinned message');
            throw error;
        }
    },

    forwardMessage: async (messageId, chatId) => {
        try {
            const { data } = await api.post(`/messages/${messageId}/forward`, { chatId });
            get().addMessage(data.message);
            toast.success('Message forwarded');
            return data.message;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to forward message');
            throw error;
        }
    },

    // Filtered chats
    getFilteredChats: () => {
        const { chats, searchQuery } = get();
        if (!searchQuery) return chats;
        return chats.filter((chat) =>
            (chat.participants || []).some((p) =>
                p &&
                (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.username?.toLowerCase().includes(searchQuery.toLowerCase()))
            )
        );
    },
}));

export default useChatStore;
