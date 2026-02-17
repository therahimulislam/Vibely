// client/src/components/user/UserProfile.jsx
// User profile side drawer

import { useState } from 'react';
import { X, Camera, Edit3, Check } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function UserProfile({ onClose }) {
    const { user, updateUser } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [isUploading, setIsUploading] = useState(false);

    const handleSave = async () => {
        try {
            const { data } = await api.put('/users/profile', { name });
            updateUser(data.user);
            setIsEditing(false);
            toast.success('Profile updated');
        } catch {
            toast.error('Failed to update profile');
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const { data } = await api.put('/users/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            updateUser(data.user);
            toast.success('Avatar updated');
        } catch {
            toast.error('Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    const [view, setView] = useState('profile'); // 'profile' | 'sessions'
    const [sessions, setSessions] = useState([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    const fetchSessions = async () => {
        setIsLoadingSessions(true);
        try {
            const { data } = await api.get('/auth/sessions');
            setSessions(data.sessions);
        } catch {
            toast.error('Failed to load sessions');
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const handleRevokeSession = async (sessionId) => {
        try {
            await api.delete(`/auth/sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s._id !== sessionId));
            toast.success('Session logged out');
        } catch {
            toast.error('Failed to logout session');
        }
    };

    const handleRevokeOthers = async () => {
        try {
            const currentToken = localStorage.getItem('refreshToken');
            await api.delete('/auth/sessions', { data: { currentRefreshToken: currentToken } });
            setSessions(prev => prev.filter(s => {
                const currentMasked = currentToken ? currentToken.slice(-5) : '';
                return s.maskedToken === currentMasked;
            }));
            toast.success('All other devices logged out');
        } catch {
            toast.error('Failed to logout other devices');
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-sm h-full glass-panel animate-slide-in-right border-l border-white/5 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setView('profile')}
                            className={`font-semibold text-sm ${view === 'profile' ? 'text-primary-400' : 'opacity-50'}`}
                        >
                            Profile
                        </button>
                        <button
                            onClick={() => { setView('sessions'); fetchSessions(); }}
                            className={`font-semibold text-sm ${view === 'sessions' ? 'text-primary-400' : 'opacity-50'}`}
                        >
                            Security
                        </button>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-50" />
                    </button>
                </div>

                {view === 'profile' ? (
                    /* Avatar */
                    <div className="p-8 flex flex-col items-center">
                        <div className="relative mb-6">
                            <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary-500/20">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                                        style={{ background: 'var(--gradient-primary)' }}>
                                        {user?.name?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                                style={{ background: 'var(--gradient-primary)' }}>
                                {isUploading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Camera className="w-4 h-4 text-white" />
                                )}
                                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                            </label>
                        </div>

                        {/* Name */}
                        <div className="w-full max-w-xs">
                            <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Name</label>
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input-glass py-2 text-sm flex-1"
                                        autoFocus
                                    />
                                    <button onClick={handleSave} className="p-2 rounded-xl bg-primary-500/20 text-primary-400">
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between glass-card px-4 py-3 rounded-xl">
                                    <span className="font-medium">{user?.name}</span>
                                    <button onClick={() => setIsEditing(true)} className="p-1 rounded-lg hover:bg-white/5">
                                        <Edit3 className="w-4 h-4 opacity-40" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Email */}
                        <div className="w-full max-w-xs mt-4">
                            <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Email</label>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <span className="text-sm opacity-70">{user?.email}</span>
                            </div>
                        </div>

                        {/* Member since */}
                        <div className="w-full max-w-xs mt-4">
                            <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Member Since</label>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <span className="text-sm opacity-70">
                                    {new Date(user?.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Security / Sessions */
                    <div className="p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Active Sessions</h3>
                            <button
                                onClick={handleRevokeOthers}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Logout all other devices
                            </button>
                        </div>

                        {isLoadingSessions ? (
                            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map(session => {
                                    const currentToken = localStorage.getItem('refreshToken');
                                    const isCurrent = currentToken && session.maskedToken === currentToken.slice(-5);

                                    return (
                                        <div key={session._id} className="glass-card p-3 rounded-xl relative group">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xl">
                                                        {session.device.toLowerCase().includes('mobile') ? '📱' : '💻'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm truncate">{session.device}</p>
                                                        {isCurrent && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-500/20 text-primary-400 border border-primary-500/20">
                                                                THIS DEVICE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs opacity-50 truncate">
                                                        {session.browser} • {session.os}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] opacity-40">
                                                        <span>{session.location}</span>
                                                        <span>•</span>
                                                        <span>Active: {new Date(session.lastActive).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {!isCurrent && (
                                                <button
                                                    onClick={() => handleRevokeSession(session._id)}
                                                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                                                    title="Logout this session"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
