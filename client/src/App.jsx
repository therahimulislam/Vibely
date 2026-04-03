// client/src/App.jsx
// Main application with routing, auth initialization, and theme management

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/useAuthStore';
import useThemeStore from './store/useThemeStore';
import useSocket from './hooks/useSocket';
import { applyChatThemePreset, DEFAULT_CHAT_THEME } from './utils/themePresets';

const lazyWithRetry = (importer, retryKey) => lazy(async () => {
    try {
        const module = await importer();
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(retryKey);
        }
        return module;
    } catch (error) {
        const isBrowser = typeof window !== 'undefined';
        const hasRetried = isBrowser && window.sessionStorage.getItem(retryKey) === '1';
        const message = `${error?.message || ''}`.toLowerCase();
        const isChunkError =
            message.includes('failed to fetch dynamically imported module')
            || message.includes('importing a module script failed')
            || message.includes('loading chunk')
            || message.includes('chunkloaderror');

        if (isBrowser && isChunkError && !hasRetried) {
            window.sessionStorage.setItem(retryKey, '1');
            window.location.reload();
            return new Promise(() => { });
        }

        throw error;
    }
});

const Login = lazyWithRetry(() => import('./pages/Login'), 'retry:login');
const Signup = lazyWithRetry(() => import('./pages/Signup'), 'retry:signup');
const VerifyOTP = lazyWithRetry(() => import('./pages/VerifyOTP'), 'retry:verify-otp');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'), 'retry:forgot-password');
const Chat = lazyWithRetry(() => import('./pages/Chat'), 'retry:chat');
const ManageSessions = lazyWithRetry(() => import('./pages/ManageSessions'), 'retry:manage-sessions');
const VideoCall = lazyWithRetry(() => import('./components/call/VideoCall'), 'retry:video-call');
const IncomingCall = lazyWithRetry(() => import('./components/call/IncomingCall'), 'retry:incoming-call');

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const AuthProvider = ({ children }) => (
    GOOGLE_CLIENT_ID
        ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
        : children
);

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuthStore();
    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="animate-pulse-soft text-primary-500 text-xl font-semibold">
                    Loading...
                </div>
            </div>
        );
    }
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Auth route wrapper (redirects if already logged in)
const AuthRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuthStore();
    if (isLoading) return null;
    return isAuthenticated ? <Navigate to="/" replace /> : children;
};

const RouteLoader = () => (
    <div className="h-screen flex items-center justify-center">
        <div className="glass-card px-5 py-3 text-sm opacity-70">Loading Vibely...</div>
    </div>
);

function AppContent() {
    useSocket(); // Initialize socket connection
    const theme = useThemeStore((state) => state.theme);

    return (
        <>
            <Suspense fallback={<RouteLoader />}>
                <Routes>
                    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
                    <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
                    <Route path="/verify-otp" element={<VerifyOTP />} />
                    <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
                    <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                    <Route path="/join/:code" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                    <Route path="/settings/sessions" element={<ProtectedRoute><ManageSessions /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <VideoCall />
                <IncomingCall />
            </Suspense>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: theme === 'dark' ? 'rgba(30, 30, 60, 0.9)' : 'rgba(255, 255, 255, 0.92)',
                        color: theme === 'dark' ? '#e2e8f0' : '#131929',
                        backdropFilter: 'blur(10px)',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(214, 220, 244, 0.72)',
                        borderRadius: '12px',
                        fontSize: '14px',
                    },
                }}
            />
        </>
    );
}

export default function App() {
    const { initialize, user } = useAuthStore();
    const theme = useThemeStore((state) => state.theme);
    const initializeTheme = useThemeStore((state) => state.initializeTheme);
    const toggleTheme = useThemeStore((state) => state.toggleTheme);
    const [chatTheme, setChatTheme] = useState(() => localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);

    // Initialize auth
    useEffect(() => {
        initialize();
        initializeTheme();
    }, [initialize, initializeTheme]);

    useEffect(() => {
        const userTheme = user?.preferences?.chatTheme;
        if (userTheme) {
            setChatTheme(userTheme);
            return;
        }
        setChatTheme(localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);
    }, [user?.preferences?.chatTheme]);

    useEffect(() => {
        applyChatThemePreset(chatTheme);
        localStorage.setItem('chatThemePreset', chatTheme);
    }, [chatTheme]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.__toggleTheme = toggleTheme;
        window.__isDark = theme === 'dark';
        window.__setChatTheme = (nextTheme) => setChatTheme(nextTheme || DEFAULT_CHAT_THEME);
    }, [theme, toggleTheme]);

    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}
