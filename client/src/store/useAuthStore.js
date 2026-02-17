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
        set({ error: null, isLoading: true });
        try {
            const { data } = await api.post('/auth/signup', { name, email, password });
            set({ isLoading: false });
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.errors?.[0] || 'Signup failed';
            set({ error: msg, isLoading: false });
            throw new Error(msg);
        }
    },

    // Verify OTP
    verifyOTP: async (email, otp) => {
        set({ error: null });
        try {
            const { data } = await api.post('/auth/verify-otp', { email, otp });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            set({ user: data.user, isAuthenticated: true });
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || 'Verification failed';
            set({ error: msg });
            throw new Error(msg);
        }
    },

    // Login
    login: async (email, password) => {
        set({ error: null, isLoading: true });
        try {
            const { data } = await api.post('/auth/login', { email, password });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            set({ user: data.user, isAuthenticated: true, isLoading: false });
            return data;
        } catch (error) {
            const msg = error.response?.data?.error || 'Login failed';
            const needsVerification = error.response?.data?.needsVerification;
            set({ error: msg, isLoading: false });
            throw Object.assign(new Error(msg), { needsVerification });
        }
    },

    // Google login
    googleLogin: async (credential) => {
        set({ error: null });
        try {
            const { data } = await api.post('/auth/google', { credential });
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
        set((state) => ({ user: { ...state.user, ...updates } }));
    },

    clearError: () => set({ error: null }),
}));

export default useAuthStore;
