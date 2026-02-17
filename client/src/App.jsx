// client/src/App.jsx
// Main application with routing, auth initialization, and theme management

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/useAuthStore';
import useSocket from './hooks/useSocket';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOTP from './pages/VerifyOTP';
import Chat from './pages/Chat';
import VideoCall from './components/call/VideoCall';
import IncomingCall from './components/call/IncomingCall';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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

function AppContent() {
    useSocket(); // Initialize socket connection

    return (
        <>
            <Routes>
                <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
                <Route path="/signup" element={<AuthRoute><Signup /></AuthRoute>} />
                <Route path="/verify-otp" element={<VerifyOTP />} />
                <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <VideoCall />
            <IncomingCall />
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
    const { initialize } = useAuthStore();
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved ? saved === 'dark' : true;
    });

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

    // Expose theme toggle globally
    window.__toggleTheme = () => setIsDark((d) => !d);
    window.__isDark = isDark;

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <Router>
                <AppContent />
            </Router>
        </GoogleOAuthProvider>
    );
}
