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

    return (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-sm h-full glass-panel animate-slide-in-right border-l border-white/5 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                    <h2 className="font-semibold">Profile</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-50" />
                    </button>
                </div>

                {/* Avatar */}
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
            </div>
        </div>
    );
}
