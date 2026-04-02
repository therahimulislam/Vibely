// client/src/pages/Chat.jsx
// Main chat page with sidebar + message area layout

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useChatStore from '../store/useChatStore';
import Sidebar from '../components/layout/Sidebar';
import MessageArea from '../components/chat/MessageArea';
import UserProfile from '../components/user/UserProfile';
import ChatDetailsDrawer from '../components/user/ChatDetailsDrawer';
import { MessageCircle } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

export default function Chat() {
    const { fetchChats, activeChat, joinGroupViaInvite } = useChatStore();
    const [profileView, setProfileView] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [handledInviteCode, setHandledInviteCode] = useState('');
    const navigate = useNavigate();
    const { code: inviteCode } = useParams();

    useEffect(() => {
        fetchChats();
    }, []);

    useEffect(() => {
        if (!inviteCode || handledInviteCode === inviteCode) return;
        setHandledInviteCode(inviteCode);

        joinGroupViaInvite(inviteCode)
            .catch(() => { })
            .finally(() => {
                navigate('/', { replace: true });
            });
    }, [inviteCode, handledInviteCode, joinGroupViaInvite, navigate]);

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
        <div className="h-[100dvh] min-h-screen flex overflow-hidden relative">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-24 left-[8%] w-72 h-72 rounded-full blur-[110px] opacity-20 bg-[#6f6bff]" />
                <div className="absolute top-[18%] right-[10%] w-80 h-80 rounded-full blur-[120px] opacity-10 bg-cyan-400" />
                <div className="absolute bottom-[-8%] left-[28%] w-72 h-72 rounded-full blur-[120px] opacity-10 bg-fuchsia-500" />
            </div>
            {/* Sidebar */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[360px] lg:w-[420px] xl:w-[448px] flex-shrink-0 min-w-0 min-h-0 p-1.5 sm:p-2 md:p-3 z-10`}>
                <ErrorBoundary>
                    <Sidebar onProfileClick={() => setProfileView({ mode: 'self' })} />
                </ErrorBoundary>
            </div>



            {/* Main Chat Area */}
            <div className={`${!showSidebar || activeChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 min-h-0 p-1.5 sm:p-2 md:p-3 md:pl-0 z-10`}>
                {activeChat ? (
                    <ErrorBoundary>
                        <MessageArea
                            onBack={handleBack}
                            onProfileClick={setProfileView}
                        />
                    </ErrorBoundary>
                ) : (
                    // Empty state
                    <div className="flex-1 flex items-center justify-center surface-elevated rounded-[28px]">
                        <div className="text-center animate-fade-in max-w-md px-5 sm:px-6 py-8">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-[28px] flex items-center justify-center animate-float shadow-[0_18px_46px_rgba(111,107,255,0.25)]"
                                style={{ background: 'var(--gradient-primary)', opacity: 0.96 }}>
                                <MessageCircle className="w-12 h-12 text-white" />
                            </div>
                            <span className="badge-pill mb-4">Private. Fast. Beautiful.</span>
                            <h2 className="text-2xl sm:text-3xl font-semibold mb-3 opacity-90">Welcome to Vibely</h2>
                            <p className="opacity-50 text-sm max-w-xs mx-auto leading-6">
                                A next-generation messaging workspace for fluid conversations, presence, calls, and shared moments.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* User Profile Drawer */}
            {profileView?.mode === 'self' && (
                <UserProfile onClose={() => setProfileView(null)} />
            )}

            {profileView && profileView.mode !== 'self' && (
                <ChatDetailsDrawer
                    mode={profileView.mode}
                    chat={profileView.chat || null}
                    user={profileView.user || null}
                    onClose={() => setProfileView(null)}
                />
            )}
        </div>
    );
}
