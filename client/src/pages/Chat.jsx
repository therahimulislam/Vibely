// client/src/pages/Chat.jsx
// Main chat page with sidebar + message area layout

import { useEffect, useState } from 'react';
import useChatStore from '../store/useChatStore';
import Sidebar from '../components/layout/Sidebar';
import MessageArea from '../components/chat/MessageArea';
import UserProfile from '../components/user/UserProfile';
import { MessageCircle } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

export default function Chat() {
    const { fetchChats, activeChat } = useChatStore();
    const [showProfile, setShowProfile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);

    useEffect(() => {
        fetchChats();
    }, []);

    // On mobile, hide sidebar when chat is active
    useEffect(() => {
        if (activeChat && window.innerWidth < 768) {
            setShowSidebar(false);
        }
    }, [activeChat]);

    const handleBack = () => {
        setShowSidebar(true);
        useChatStore.getState().setActiveChat(null);
    };

    return (
        <div className="h-[100dvh] min-h-screen flex overflow-hidden">
            {/* Sidebar */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] lg:w-[400px] xl:w-[420px] flex-shrink-0 min-w-0`}>
                <ErrorBoundary>
                    <Sidebar onProfileClick={() => setShowProfile(true)} />
                </ErrorBoundary>
            </div>



            {/* Main Chat Area */}
            <div className={`${!showSidebar || activeChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
                {activeChat ? (
                    <ErrorBoundary>
                        <MessageArea
                            onBack={handleBack}
                            onProfileClick={() => setShowProfile(true)}
                        />
                    </ErrorBoundary>
                ) : (
                    // Empty state
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center animate-fade-in">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center animate-float"
                                style={{ background: 'var(--gradient-primary)', opacity: 0.8 }}>
                                <MessageCircle className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 opacity-80">Vibely Messenger</h2>
                            <p className="opacity-40 text-sm max-w-xs mx-auto">
                                Select a conversation or start a new chat to begin messaging
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* User Profile Drawer */}
            {showProfile && (
                <UserProfile onClose={() => setShowProfile(false)} />
            )}
        </div>
    );
}
