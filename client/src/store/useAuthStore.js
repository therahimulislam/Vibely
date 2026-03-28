import { create } from 'zustand';
import api from '../api/axios';
import { getDeviceId, getDeviceInfo } from '../utils/deviceUtils';

const useAuthStore = create((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    // Initialize auth state from localStorage
    initialize: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            set({ isLoading: false, isAuthenticated: false });
            return;
        }

        try {
            const { data } = await api.get('/auth/me');
            set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (error) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            set({ isLoading: false, isAuthenticated: false });
        }
    },

    // Signup
    signup: async (name, email, password) => {
        set({ error: null }); // Removed isLoading: true
        try {
            const { data } = await api.post('/auth/signup', { name, email, password });
            // isLoading is managed locally in components
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.errors?.[0] || 'Signup failed';
            set({ error: msg });
            throw new Error(msg);
        }
    },

    // Verify OTP
    verifyOTP: async (email, otp) => {
        set({ error: null });
        try {
            const deviceId = getDeviceId();
            const deviceInfo = await getDeviceInfo();
            const { data } = await api.post('/auth/verify-otp', { email, otp, deviceId, deviceInfo });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            set({ user: data.user, isAuthenticated: true });
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.errors?.[0] || 'Verification failed';
            set({ error: msg });
            throw new Error(msg);
        }
    },

    // Login
    login: async (email, password) => {
        set({ error: null }); // Removed isLoading: true
        try {
            const deviceId = getDeviceId();
            const deviceInfo = await getDeviceInfo();
            const { data } = await api.post('/auth/login', { email, password, deviceId, deviceInfo });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            set({ user: data.user, isAuthenticated: true }); // Removed isLoading: false
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.errors?.[0] || 'Login failed';
            const needsVerification = error.response?.data?.needsVerification;
            set({ error: msg }); // Removed isLoading: false
            throw Object.assign(new Error(msg), { needsVerification });
        }
    },

    // Google login
    googleLogin: async (credential) => {
        set({ error: null });
        try {
            const deviceId = getDeviceId();
            const deviceInfo = await getDeviceInfo();
            const { data } = await api.post('/auth/google', { credential, deviceId, deviceInfo });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            set({ user: data.user, isAuthenticated: true });
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || 'Google login failed';
            set({ error: msg });
            throw new Error(msg);
        }
    },

    // Resend OTP
    resendOTP: async (email) => {
        try {
            const { data } = await api.post('/auth/send-otp', { email });
            return data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to resend OTP');
        }
    },

    forgotPassword: async (email) => {
        try {
            const { data } = await api.post('/auth/forgot-password', { email });
            return data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to send reset OTP');
        }
    },

    resetPasswordWithOTP: async (email, otp, newPassword) => {
        try {
            const { data } = await api.post('/auth/reset-password', { email, otp, newPassword });
            return data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to reset password');
        }
    },

    // Get active sessions
    getSessions: async () => {
        try {
            const { data } = await api.get('/auth/sessions');
            return data.sessions;
        } catch (error) {
            console.error('Failed to fetch sessions', error);
            return [];
        }
    },

    // Revoke session
    revokeSession: async (sessionId) => {
        try {
            await api.delete(`/auth/sessions/${sessionId}`);
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to revoke session');
        }
    },

    // Revoke all other sessions
    revokeAllOtherSessions: async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            await api.delete('/auth/sessions', { data: { currentRefreshToken: refreshToken } });
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to revoke other sessions');
        }
    },

    // Logout
    logout: async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                await api.post('/auth/logout', { refreshToken });
            } catch (err) {
                console.error('Logout API failed', err);
            }
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, isAuthenticated: false, error: null });
    },

    // Update user in store
    updateUser: (updates) => {
        set((state) => ({
            user: {
                ...state.user,
                ...updates,
                preferences: {
                    ...(state.user?.preferences || {}),
                    ...(updates?.preferences || {}),
                },
            },
        }));
    },

    saveChatFolders: async (folders) => {
        try {
            const { data } = await api.put('/users/chat-folders', { folders });
            set((state) => ({
                user: {
                    ...state.user,
                    ...data.user,
                    preferences: {
                        ...(state.user?.preferences || {}),
                        ...(data.user?.preferences || {}),
                        chatFolders: data.chatFolders || data.user?.preferences?.chatFolders || [],
                    },
                },
            }));
            return data.chatFolders || [];
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to save chat folders');
        }
    },

    saveChatNotificationSettings: async (payload) => {
        try {
            const { data } = await api.put('/users/chat-notifications', payload);
            set((state) => ({
                user: {
                    ...state.user,
                    ...data.user,
                    preferences: {
                        ...(state.user?.preferences || {}),
                        ...(data.user?.preferences || {}),
                        chatNotifications: data.user?.preferences?.chatNotifications || [],
                    },
                },
            }));
            return data.chatNotification;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to save notification settings');
        }
    },

    saveChatDraft: async (chatId, text) => {
        try {
            const { data } = await api.put('/users/chat-draft', { chatId, text });
            set((state) => ({
                user: {
                    ...state.user,
                    ...data.user,
                    preferences: {
                        ...(state.user?.preferences || {}),
                        ...(data.user?.preferences || {}),
                        chatDrafts: data.chatDrafts || data.user?.preferences?.chatDrafts || [],
                    },
                },
            }));
            return data.chatDrafts || [];
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to save draft');
        }
    },

    addContact: async (userId) => {
        try {
            await api.post(`/users/contacts/${userId}`);
            set((state) => ({
                user: {
                    ...state.user,
                    contacts: Array.from(new Set([...(state.user?.contacts || []), userId])),
                },
            }));
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to add contact');
        }
    },

    removeContact: async (userId) => {
        try {
            await api.delete(`/users/contacts/${userId}`);
            set((state) => ({
                user: {
                    ...state.user,
                    contacts: (state.user?.contacts || []).filter((id) => id !== userId),
                },
            }));
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to remove contact');
        }
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
