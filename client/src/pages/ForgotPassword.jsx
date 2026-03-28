// client/src/pages/ForgotPassword.jsx
// Reset password flow using OTP

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import ThemeToggle from '../components/layout/ThemeToggle';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const location = useLocation();
    const { forgotPassword, resetPasswordWithOTP } = useAuthStore();
    const [email, setEmail] = useState(location.state?.email || '');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(location.state?.email ? 'reset' : 'request');
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (step === 'reset') {
            inputRefs.current[0]?.focus();
        }
    }, [step]);

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    const handleRequestOtp = async (e) => {
        e?.preventDefault?.();
        if (!email.trim()) return;

        setIsLoading(true);
        try {
            await forgotPassword(email.trim());
            toast.success('Reset OTP sent to your email');
            setStep('reset');
            setResendCooldown(60);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangeOtp = (index, value) => {
        if (!/^\d*$/.test(value)) return;

        const next = [...otp];
        next[index] = value.slice(-1);
        setOtp(next);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtp(pasted.split(''));
            inputRefs.current[5]?.focus();
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        const code = otp.join('');

        if (code.length !== 6) {
            toast.error('Enter the 6-digit OTP');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        try {
            await resetPasswordWithOTP(email.trim(), code, newPassword);
            toast.success('Password updated successfully');
            navigate('/login', { replace: true, state: { email } });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setIsLoading(true);
        try {
            await forgotPassword(email.trim());
            toast.success('New OTP sent to your email');
            setResendCooldown(60);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="bg-orb bg-orb-1" />
            <div className="bg-orb bg-orb-2" />
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            <div className="glass-card w-full max-w-md p-6 sm:p-8 animate-slide-up relative z-10">
                <button
                    onClick={() => navigate('/login')}
                    className="flex items-center gap-1 text-sm opacity-50 hover:opacity-80 transition-opacity mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to login
                </button>

                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--gradient-accent)' }}
                    >
                        <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Reset Password</h1>
                    <p className="text-sm opacity-60 mt-2">
                        {step === 'request'
                            ? 'Enter your email to get a reset OTP'
                            : 'Enter the OTP and choose a new password'}
                    </p>
                </div>

                {step === 'request' ? (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                required
                                className="input-glass pl-11"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending OTP...' : 'Send Reset OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div className="glass-card px-4 py-3 rounded-2xl">
                            <p className="text-xs opacity-50 mb-1">Resetting password for</p>
                            <p className="text-sm font-medium break-all">{email}</p>
                        </div>

                        <div onPaste={handlePaste}>
                            <p className="text-xs opacity-50 mb-3 uppercase tracking-wider">OTP</p>
                            <div className="flex justify-center gap-2 sm:gap-3">
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (inputRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleChangeOtp(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="otp-input"
                                        disabled={isLoading}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password"
                                className="input-glass pl-11"
                                minLength={6}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Resetting password...' : 'Reset Password'}
                        </button>

                        <div className="text-center">
                            <p className="text-sm opacity-50 mb-2">Didn&apos;t receive the code?</p>
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || isLoading}
                                className="text-primary-400 hover:text-primary-300 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                            </button>
                        </div>
                    </form>
                )}

                <p className="text-center mt-6 text-sm opacity-60">
                    Remembered your password?{' '}
                    <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
