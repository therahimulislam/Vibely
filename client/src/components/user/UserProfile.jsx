// client/src/components/user/UserProfile.jsx
// User profile side drawer

import { useEffect, useState } from 'react';
import { X, Camera, Edit3, Check, Monitor, Smartphone, Shield, Clock, Globe, Instagram, AtSign } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AvatarCropModal from './AvatarCropModal';
import AvatarFallback from '../ui/AvatarFallback';
import { CHAT_THEME_PRESETS, DEFAULT_CHAT_THEME } from '../../utils/themePresets';

export default function UserProfile({ onClose }) {
    const { user, updateUser } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [socialLinks, setSocialLinks] = useState({
        website: user?.socialLinks?.website || '',
        instagram: user?.socialLinks?.instagram || '',
        x: user?.socialLinks?.x || '',
    });
    const [chatTheme, setChatTheme] = useState(user?.preferences?.chatTheme || localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    useEffect(() => {
        setName(user?.name || '');
        setUsername(user?.username || '');
        setBio(user?.bio || '');
        setSocialLinks({
            website: user?.socialLinks?.website || '',
            instagram: user?.socialLinks?.instagram || '',
            x: user?.socialLinks?.x || '',
        });
        setChatTheme(user?.preferences?.chatTheme || localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);
    }, [user]);

    const handleSave = async () => {
        try {
            const { data } = await api.put('/users/profile', {
                name,
                username,
                bio,
                socialLinks,
                chatTheme,
            });
            updateUser(data.user);
            window.__setChatTheme?.(data.user?.preferences?.chatTheme || chatTheme);
            setIsEditing(false);
            toast.success('Profile updated');
        } catch {
            toast.error('Failed to update profile');
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPendingAvatarFile(file);
    };

    const uploadAvatar = async (file) => {
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
            setPendingAvatarFile(null);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

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
            setSessions(prev => prev.filter(s => s.isCurrent));
            toast.success('All other devices logged out');
        } catch {
            toast.error('Failed to logout other devices');
        }
    };

    const getDeviceIcon = (deviceType, os) => {
        const type = deviceType?.toLowerCase() || '';
        const osName = os?.toLowerCase() || '';

        if (type.includes('mobile') || type.includes('phone') || osName.includes('android') || osName.includes('ios')) {
            return <Smartphone className="w-5 h-5 text-white" />;
        }

        return <Monitor className="w-5 h-5 text-white" />;
    };

    const handleCancelEdit = () => {
        setName(user?.name || '');
        setUsername(user?.username || '');
        setBio(user?.bio || '');
        setSocialLinks({
            website: user?.socialLinks?.website || '',
            instagram: user?.socialLinks?.instagram || '',
            x: user?.socialLinks?.x || '',
        });
        setChatTheme(user?.preferences?.chatTheme || localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);
        window.__setChatTheme?.(user?.preferences?.chatTheme || DEFAULT_CHAT_THEME);
        setIsEditing(false);
    };

    const themeOptions = Object.values(CHAT_THEME_PRESETS);

    return (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full sm:max-w-sm md:max-w-md lg:max-w-lg h-[100dvh] glass-panel animate-slide-in-right border-l border-white/5 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 p-4 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-[rgba(10,12,20,0.45)]">
                    <div>
                        <h2 className="font-semibold text-sm">Account Management</h2>
                        <p className="text-xs opacity-45 mt-0.5">Profile details, active devices, and session controls</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-50" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                    <section className="glass-card rounded-3xl p-5 sm:p-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="relative mb-5">
                                <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary-500/20">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <AvatarFallback name={user?.name} className="text-3xl" />
                                    )}
                                </div>
                                <label
                                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                                    style={{ background: 'var(--gradient-primary)' }}
                                >
                                    {isUploading ? (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Camera className="w-4 h-4 text-white" />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                </label>
                            </div>

                            <h3 className="text-lg font-semibold">{user?.name}</h3>
                            <p className="text-sm opacity-55">@{user?.username}</p>
                            {!isEditing && user?.bio && (
                                <p className="text-sm opacity-60 mt-3 max-w-sm leading-6">
                                    {user.bio}
                                </p>
                            )}
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <label className="text-xs opacity-40 uppercase tracking-wider block">Name</label>
                                    {!isEditing ? (
                                        <button onClick={() => setIsEditing(true)} className="p-1 rounded-lg hover:bg-white/5">
                                            <Edit3 className="w-4 h-4 opacity-40" />
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleCancelEdit} className="text-xs opacity-55 hover:opacity-85 transition-opacity">
                                                Cancel
                                            </button>
                                            <button onClick={handleSave} className="p-2 rounded-xl bg-primary-500/20 text-primary-400">
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isEditing ? (
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input-glass py-2 text-sm flex-1"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="glass-card px-4 py-3 rounded-xl">
                                        <span className="font-medium">{user?.name}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Username</label>
                                {isEditing ? (
                                    <input
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                        className="input-glass py-2 text-sm"
                                    />
                                ) : (
                                    <div className="glass-card px-4 py-3 rounded-xl">
                                        <span className="text-sm opacity-70">@{user?.username}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Bio</label>
                                {isEditing ? (
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value.slice(0, 160))}
                                        className="input-glass py-2 text-sm min-h-[96px] resize-none"
                                        placeholder="Add a short bio"
                                    />
                                ) : (
                                    <div className="glass-card px-4 py-3 rounded-xl">
                                        <span className="text-sm opacity-70 whitespace-pre-wrap">
                                            {user?.bio || 'No bio added yet'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Email</label>
                                <div className="glass-card px-4 py-3 rounded-xl">
                                    <span className="text-sm opacity-70">{user?.email}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Account Created</label>
                                <div className="glass-card px-4 py-3 rounded-xl">
                                    <span className="text-sm opacity-70">
                                        {user?.createdAt
                                            ? new Date(user.createdAt).toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' })
                                            : 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="glass-card rounded-3xl p-5 sm:p-6">
                        <div className="mb-4">
                            <h3 className="font-semibold text-sm">Public Identity</h3>
                            <p className="text-xs opacity-45 mt-1">Let other people know more about you without exposing private account details.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Website</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-35" />
                                        <input
                                            value={socialLinks.website}
                                            onChange={(e) => setSocialLinks((current) => ({ ...current, website: e.target.value }))}
                                            className="input-glass py-2 text-sm pl-10"
                                            placeholder="your-site.com"
                                        />
                                    </div>
                                ) : (
                                    <div className="glass-card px-4 py-3 rounded-xl">
                                        <span className="text-sm opacity-70 break-all">{user?.socialLinks?.website || 'Not added'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">Instagram</label>
                                    {isEditing ? (
                                        <div className="relative">
                                            <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-35" />
                                            <input
                                                value={socialLinks.instagram}
                                                onChange={(e) => setSocialLinks((current) => ({ ...current, instagram: e.target.value }))}
                                                className="input-glass py-2 text-sm pl-10"
                                                placeholder="@handle"
                                            />
                                        </div>
                                    ) : (
                                        <div className="glass-card px-4 py-3 rounded-xl">
                                            <span className="text-sm opacity-70 break-all">{user?.socialLinks?.instagram || 'Not added'}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs opacity-40 uppercase tracking-wider mb-1 block">X / Twitter</label>
                                    {isEditing ? (
                                        <div className="relative">
                                            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-35" />
                                            <input
                                                value={socialLinks.x}
                                                onChange={(e) => setSocialLinks((current) => ({ ...current, x: e.target.value }))}
                                                className="input-glass py-2 text-sm pl-10"
                                                placeholder="@handle"
                                            />
                                        </div>
                                    ) : (
                                        <div className="glass-card px-4 py-3 rounded-xl">
                                            <span className="text-sm opacity-70 break-all">{user?.socialLinks?.x || 'Not added'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="glass-card rounded-3xl p-5 sm:p-6">
                        <div className="mb-4">
                            <h3 className="font-semibold text-sm">Chat Theme</h3>
                            <p className="text-xs opacity-45 mt-1">Choose a premium workspace palette that keeps Vibely unique.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {themeOptions.map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => {
                                        setChatTheme(theme.id);
                                        window.__setChatTheme?.(theme.id);
                                        if (!isEditing) setIsEditing(true);
                                    }}
                                    className={`rounded-2xl border p-3 text-left transition-all ${chatTheme === theme.id ? 'border-primary-400/50 shadow-[0_10px_24px_rgba(111,107,255,0.18)]' : 'border-white/10 hover:bg-white/5'}`}
                                >
                                    <div className="h-20 rounded-xl mb-3 border border-white/10" style={{ background: theme.preview }} />
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold">{theme.label}</p>
                                            <p className="text-xs opacity-50 mt-1">{theme.description}</p>
                                        </div>
                                        {chatTheme === theme.id && (
                                            <span className="badge-pill text-primary-100" style={{ background: 'var(--gradient-primary)' }}>
                                                Active
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="glass-card rounded-3xl p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-primary-400" />
                                    Device Management
                                </h3>
                                <p className="text-xs opacity-45 mt-1">See your active devices, location, and recent activity.</p>
                            </div>
                            {sessions.length > 1 && (
                                <button
                                    onClick={handleRevokeOthers}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                    Logout others
                                </button>
                            )}
                        </div>

                        {isLoadingSessions ? (
                            <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((session) => {
                                    const isCurrent = !!session.isCurrent;

                                    return (
                                        <div key={session._id} className="rounded-2xl border border-white/8 bg-white/5 p-4 relative group">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                                    {getDeviceIcon(session.device, session.os)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-medium text-sm truncate">{session.device || 'Unknown device'}</p>
                                                        {isCurrent && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-500/20 text-primary-400 border border-primary-500/20">
                                                                THIS DEVICE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs opacity-55 truncate mt-1">
                                                        {session.browser || 'Unknown browser'} • {session.os || 'Unknown OS'}
                                                    </p>
                                                    <div className="mt-2 space-y-1.5 text-[11px] opacity-55">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-3.5 h-3.5" />
                                                            <span className="truncate">{session.location || 'Unknown location'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span className="truncate">
                                                                {isCurrent
                                                                    ? 'Active now'
                                                                    : `Last active ${new Date(session.lastActive).toLocaleString([], {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {!isCurrent && (
                                                <button
                                                    onClick={() => handleRevokeSession(session._id)}
                                                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/10 text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
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
                    </section>
                </div>
            </div>

            {pendingAvatarFile && (
                <AvatarCropModal
                    file={pendingAvatarFile}
                    onCancel={() => setPendingAvatarFile(null)}
                    onConfirm={uploadAvatar}
                    title="Adjust profile photo"
                    subtitle="Crop your avatar before uploading"
                    confirmLabel="Use photo"
                    outputWidth={512}
                    outputHeight={512}
                    outputMimeType="image/png"
                    maskShape="circle"
                />
            )}
        </div>
    );
}
