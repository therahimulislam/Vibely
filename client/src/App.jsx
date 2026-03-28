// client/src/App.jsx
// Main application with routing, auth initialization, and theme management

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/useAuthStore';
import useSocket from './hooks/useSocket';
import { applyChatThemePreset, DEFAULT_CHAT_THEME } from './utils/themePresets';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Chat = lazy(() => import('./pages/Chat'));
const ManageSessions = lazy(() => import('./pages/ManageSessions'));
const VideoCall = lazy(() => import('./components/call/VideoCall'));
const IncomingCall = lazy(() => import('./components/call/IncomingCall'));

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

    return (
        <>
            <Suspense fallback={<RouteLoader />}>
                <Routes>
                    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
                    <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
                    <Route path="/verify-otp" element={<VerifyOTP />} />
                    <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
                    <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
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
                        background: 'rgba(30, 30, 60, 0.9)',
                        color: '#e2e8f0',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
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
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : true;
    });
    const [chatTheme, setChatTheme] = useState(() => localStorage.getItem('chatThemePreset') || DEFAULT_CHAT_THEME);

    // Initialize auth
    useEffect(() => {
        initialize();
    }, []);

    // Apply theme
    useEffect(() => {
        document.body.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);

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

    // Expose theme toggle globally
    window.__toggleTheme = () => setIsDark((d) => !d);
    window.__isDark = isDark;
    window.__setChatTheme = (theme) => setChatTheme(theme || DEFAULT_CHAT_THEME);

    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}
