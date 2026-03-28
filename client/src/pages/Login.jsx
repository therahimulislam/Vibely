// client/src/pages/Login.jsx
// Login page with glassmorphism design and animated background

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AlertCircle, Eye, EyeOff, Lock, Mail, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import useThemeStore from '../store/useThemeStore';
import ThemeToggle from '../components/layout/ThemeToggle';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
    const location = useLocation();
    const navigate = useNavigate();
    const { login, googleLogin, clearError } = useAuthStore();
    const theme = useThemeStore((state) => state.theme);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (location.state?.email) {
            setEmail(location.state.email);
        }
    }, [location.state?.email]);

    const clearFormError = () => {
        if (formError) {
            setFormError('');
        }
        clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setFormError('');
        clearError();

        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/');
        } catch (err) {
            if (err.needsVerification) {
                navigate('/verify-otp', { state: { email } });
                return;
            }

            const message = err.message === 'Invalid credentials'
                ? "Email or password doesn't match"
                : err.message;

            setFormError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (response) => {
        setFormError('');

        try {
            await googleLogin(response.credential);
            toast.success('Welcome to Vibely!');
            navigate('/');
        } catch (err) {
            setFormError(err.message);
            toast.error(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="bg-orb bg-orb-1" />
            <div className="bg-orb bg-orb-2" />
            <div className="bg-orb bg-orb-3" />
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            <div className="glass-card w-full max-w-md p-6 sm:p-8 animate-slide-up relative z-10">
                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--gradient-primary)' }}
                    >
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                        Vibely
                    </h1>
                    <p className="text-sm opacity-60 mt-1">Messaging Reimagined</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                        <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                clearFormError();
                                setEmail(e.target.value);
                            }}
                            placeholder="Email address"
                            required
                            className="input-glass pl-11"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                                clearFormError();
                                setPassword(e.target.value);
                            }}
                            placeholder="Password"
                            required
                            className={`input-glass pl-11 pr-11 ${formError ? 'border-red-400/60 focus:border-red-400' : ''}`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>

                    {formError && (
                        <div className="glass-card rounded-2xl px-4 py-3 border border-red-400/25 bg-red-500/10 text-red-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{formError}</p>
                        </div>
                    )}

                    <div className="flex justify-end -mt-1">
                        <Link
                            to="/forgot-password"
                            state={{ email }}
                            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        id="login-submit"
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Signing in...
                            </span>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs opacity-40 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="flex justify-center">
                    {GOOGLE_CLIENT_ID ? (
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                                setFormError('Google sign-in could not be completed');
                                toast.error('Google login failed');
                            }}
                            theme={theme === 'dark' ? 'filled_black' : 'outline'}
                            shape="pill"
                            size="large"
                            text="continue_with"
                        />
                    ) : (
                        <div className="glass-card px-4 py-3 rounded-2xl text-center text-sm opacity-70">
                            Google sign-in is not configured on this client yet.
                        </div>
                    )}
                </div>

                <p className="text-center mt-6 text-sm opacity-60">
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
