// client/src/components/chat/ChatList.jsx
// Chat list showing all conversations

import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import ChatItem from './ChatItem';
import { MessageCircle } from 'lucide-react';

export default function ChatList() {
    const { chats, activeChat, setActiveChat, searchQuery, isLoadingChats, onlineUsers, typingUsers } = useChatStore();
    const { user } = useAuthStore();

    // Filter chats based on search
    const safeChats = Array.isArray(chats) ? chats : [];
    const filteredChats = searchQuery
        ? safeChats.filter((chat) => {
            if (chat.isGroup) {
                return chat.groupName.toLowerCase().includes(searchQuery.toLowerCase());
            }
            // Filter nulls first
            const validParticipants = (chat.participants || []).filter(p => p);
            return validParticipants.some(
                (p) =>
                    p._id !== user._id &&
                    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.email.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        })
        : chats;

    // Sort: pinned first, then by updatedAt
    const sortedChats = [...filteredChats].sort((a, b) => {
        const aPinned = a.pinnedBy?.includes(user._id);
        const bPinned = b.pinnedBy?.includes(user._id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

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
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                <p className="text-xs opacity-30 text-center mt-1">
                    Start a new chat using the + button above
                </p>
            </div>
        );
    }

    return (
        <div className="px-2 py-1 space-y-0.5">
            {sortedChats.map((chat) => {
                let displayUser;
                let isOnline = false;

                if (chat.isGroup) {
                    displayUser = {
                        _id: chat._id,
                        name: chat.groupName,
                        avatar: chat.groupAvatar,
                        isGroup: true
                    };
                    // Optional: show online if any member is online? For now false
                } else {
                    const validParticipants = (chat.participants || []).filter(p => p);
                    displayUser = validParticipants.find((p) => p._id !== user._id);
                    if (!displayUser) return null;
                    // Safeguard against onlineUsers not being a Set
                    isOnline = onlineUsers instanceof Set ? onlineUsers.has(displayUser._id) : false;
                }

                const isTyping = typingUsers?.[chat._id]; // Just check if truthy for now
                const unread = chat.unreadCount?.[user._id] || 0;
                const isPinned = chat.pinnedBy?.includes(user._id);

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
                        onClick={() => setActiveChat(chat)}
                    />
                );
            })}
        </div>
    );
}
