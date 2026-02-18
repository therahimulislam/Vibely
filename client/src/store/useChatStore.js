// client/src/store/useChatStore.js
// Chat and messaging state management

import { create } from 'zustand';
import api from '../api/axios';

const useChatStore = create((set, get) => ({
    chats: [],
    error: null,

    // Fetch all chats for current user
    fetchChats: async () => {
        set({ isLoadingChats: true, error: null });
        try {
            const { data } = await api.get('/chats');
            set({ chats: data.chats || [], isLoadingChats: false });
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
        set({ activeChat: chat, messages: [], currentPage: 1, hasMoreMessages: false, error: null });
        if (chat) {
            await get().fetchMessages(chat._id, 1);
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

    // Create or find 1-on-1 chat
    createChat: async (participantId) => {
        set({ error: null });
        try {
            const { data } = await api.post('/chats/create', { participantId });
            if (data.isNew) {
                set((state) => ({ chats: [data.chat, ...state.chats] }));
            }
            set({ activeChat: data.chat });
            await get().fetchMessages(data.chat._id, 1);
            return data.chat;
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to create chat';
            set({ error: msg });
            console.error('Failed to create chat:', error);
            throw error;
        }
    },

    // Add message (from socket or API)
    addMessage: (message) => {
        set((state) => {
            const exists = state.messages.some((m) => m._id === message._id);
            if (exists) return state;

            // Update the chat's last message in the list
            const updatedChats = state.chats.map((chat) => {
                if (chat._id === message.chatId) {
                    return { ...chat, lastMessage: message, updatedAt: new Date().toISOString() };
                }
                return chat;
            });

            // Sort chats by updatedAt
            updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            return {
                messages: [...state.messages, message],
                chats: updatedChats,
            };
        });
    },

    // Update message (edit, reaction, status)
    updateMessage: (updatedMessage) => {
        set((state) => ({
            messages: state.messages.map((m) =>
                m._id === updatedMessage._id ? updatedMessage : m
            ),
        }));
    },

    // Delete message
    removeMessage: (messageId, type = 'me') => {
        set((state) => ({
            messages: type === 'everyone'
                ? state.messages.map((m) =>
                    m._id === messageId ? { ...m, isDeleted: true, text: '', imageUrl: '', videoUrl: '' } : m
                )
                : state.messages.filter((m) => m._id !== messageId)
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
            set((state) => ({
                chats: state.chats.map((chat) =>
                    chat._id === chatId
                        ? { ...chat, isPinned: data.pinned }
                        : chat
                ),
            }));
        } catch (error) {
            console.error('Failed to toggle pin:', error);
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
    addToGroup: async (chatId, userId, email) => {
        try {
            const { data } = await api.put('/chats/group/add', { chatId, userId, email });
            set((state) => ({
                chats: state.chats.map((c) => (c._id === chatId ? data.chat : c)),
                activeChat: state.activeChat?._id === chatId ? data.chat : state.activeChat,
            }));
            toast.success('User added to group');
        } catch (error) {
            console.error('Failed to add to group:', error);
            toast.error(error.response?.data?.error || 'Failed to add user');
        }
    },

    // Typing indicators
    setTyping: (chatId, userId) => {
        set((state) => ({
            typingUsers: { ...state.typingUsers, [chatId]: userId },
        }));
    },

    clearTyping: (chatId) => {
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
            return { onlineUsers: newSet };
        });
    },

    setUserOffline: (userId) => {
        set((state) => {
            const newSet = new Set(state.onlineUsers);
            newSet.delete(userId);
            return { onlineUsers: newSet };
        });
    },

    // Search
    setSearchQuery: (query) => set({ searchQuery: query }),

    // Filtered chats
    getFilteredChats: () => {
        const { chats, searchQuery } = get();
        if (!searchQuery) return chats;
        return chats.filter((chat) =>
            chat.participants.some((p) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    },
}));

export default useChatStore;
