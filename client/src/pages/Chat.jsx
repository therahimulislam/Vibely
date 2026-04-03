// client/src/pages/Chat.jsx
// Main chat page with sidebar + message area layout

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import useStatusStore from '../store/useStatusStore';
import Sidebar from '../components/layout/Sidebar';
import MessageArea from '../components/chat/MessageArea';
import UserProfile from '../components/user/UserProfile';
import ChatDetailsDrawer from '../components/user/ChatDetailsDrawer';
import StatusPage from '../components/status/StatusPage';
import StatusComposerModal from '../components/status/StatusComposerModal';
import StatusViewer from '../components/status/StatusViewer';
import { MessageCircle } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';

export default function Chat() {
    const { fetchChats, activeChat, joinGroupViaInvite } = useChatStore();
    const { user } = useAuthStore();
    const { myStatuses, statuses, fetchStatuses, isLoading: isLoadingStatuses } = useStatusStore();
    const [profileView, setProfileView] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [handledInviteCode, setHandledInviteCode] = useState('');
    const [workspaceView, setWorkspaceView] = useState('chats');
    const [showStatusComposer, setShowStatusComposer] = useState(false);
    const [activeStatusUserId, setActiveStatusUserId] = useState(null);
    const [isOwnStatusGroup, setIsOwnStatusGroup] = useState(false);
    const navigate = useNavigate();
    const { code: inviteCode } = useParams();

    const activeStatusGroup = useMemo(() => {
        if (!activeStatusUserId) return null;
        return isOwnStatusGroup
            ? myStatuses
            : (Array.isArray(statuses) ? statuses.find((group) => group?.user?._id === activeStatusUserId) : null) || null;
    }, [activeStatusUserId, isOwnStatusGroup, myStatuses, statuses]);

    useEffect(() => {
        fetchChats();
        fetchStatuses();
    }, [fetchChats, fetchStatuses]);

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
        if (activeChat && typeof window !== 'undefined' && window.innerWidth < 768) {
            setShowSidebar(false);
        }
        if (activeChat) {
            setWorkspaceView('chats');
        }
    }, [activeChat]);

    const handleBack = () => {
        setShowSidebar(true);
        useChatStore.getState().setActiveChat(null);
    };
    const handleOpenStatusPage = (shouldOpen = true) => {
        setWorkspaceView(shouldOpen ? 'status' : 'chats');
        if (typeof window !== 'undefined' && window.innerWidth < 768 && shouldOpen) {
            setShowSidebar(false);
        }
        if (!shouldOpen && typeof window !== 'undefined' && window.innerWidth < 768 && !activeChat) {
            setShowSidebar(true);
        }
    };
    const handleOpenStatusGroup = (group, isOwn = false) => {
        setActiveStatusUserId(group?.user?._id || null);
        setIsOwnStatusGroup(isOwn);
    };
    const handleStatusBack = () => {
        setShowSidebar(true);
    };

    return (
        <div className="h-[100dvh] flex overflow-hidden relative">
            {/* Animated aurora background orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-16 w-[480px] h-[480px] rounded-full blur-[120px] animate-breathe bg-[#7c6dff]"
                    style={{ animationDelay: '0s', opacity: 0.15 }} />
                <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[130px] animate-breathe bg-[#06b6d4]"
                    style={{ animationDelay: '2.5s', opacity: 0.10 }} />
                <div className="absolute bottom-[-10%] left-[30%] w-[380px] h-[380px] rounded-full blur-[130px] animate-breathe bg-[#9d4edd]"
                    style={{ animationDelay: '5s', opacity: 0.10 }} />
            </div>
            {/* Sidebar */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[360px] lg:w-[420px] xl:w-[448px] flex-shrink-0 min-w-0 min-h-0 p-1.5 sm:p-2 md:p-3 z-10`}>
                <ErrorBoundary>
                    <Sidebar
                        onProfileClick={() => setProfileView({ mode: 'self' })}
                        onOpenStatusPage={handleOpenStatusPage}
                        onCreateStatus={() => setShowStatusComposer(true)}
                        onOpenStatusGroup={handleOpenStatusGroup}
                    />
                </ErrorBoundary>
            </div>



            {/* Main Chat Area */}
            <div className={`${!showSidebar || activeChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 min-h-0 p-1.5 sm:p-2 md:p-3 md:pl-0 z-10`}>
                {workspaceView === 'status' ? (
                    <ErrorBoundary>
                        <StatusPage
                            user={user}
                            myStatuses={myStatuses}
                            statuses={statuses}
                            isLoading={isLoadingStatuses}
                            onCreate={() => setShowStatusComposer(true)}
                            onOpenGroup={handleOpenStatusGroup}
                            onRefresh={() => fetchStatuses()}
                            onBack={handleStatusBack}
                        />
                    </ErrorBoundary>
                ) : activeChat ? (
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
