// client/src/pages/VerifyOTP.jsx
// OTP verification page with auto-focus input boxes

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import ThemeToggle from '../components/layout/ThemeToggle';

export default function VerifyOTP() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;
    const { verifyOTP, resendOTP } = useAuthStore();

    useEffect(() => {
        if (!email) {
            navigate('/signup');
            return;
        }
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newOtp.every((d) => d !== '') && value) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const newOtp = pasted.split('');
            setOtp(newOtp);
            inputRefs.current[5]?.focus();
            handleVerify(pasted);
        }
    };

    const handleVerify = async (code) => {
        setIsLoading(true);
        try {
            await verifyOTP(email, code);
            toast.success('Email verified! Welcome to Vibely!');
            navigate('/');
        } catch (err) {
            toast.error(err.message);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        try {
            await resendOTP(email);
            toast.success('New OTP sent to your email');
            setResendCooldown(60);
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="bg-orb bg-orb-1" />
            <div className="bg-orb bg-orb-2" />
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            <div className="glass-card w-full max-w-md p-8 animate-slide-up relative z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-sm opacity-50 hover:opacity-80 transition-opacity mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--gradient-accent)' }}>
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Verify Your Email</h1>
                    <p className="text-sm opacity-60 mt-2">
                        We sent a 6-digit code to<br />
                        <span className="text-primary-400 font-medium">{email}</span>
                    </p>
                </div>

                {/* OTP Inputs */}
                <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => (inputRefs.current[index] = el)}
                            id={`otp-input-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="otp-input"
                            disabled={isLoading}
                        />
                    ))}
                </div>

                {isLoading && (
                    <div className="flex justify-center mb-4">
                        <span className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                    </div>
                )}

                {/* Resend */}
                <div className="text-center">
                    <p className="text-sm opacity-50 mb-2">Didn't receive the code?</p>
                    <button
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                        className="text-primary-400 hover:text-primary-300 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                </div>
            </div>
        </div>
    );
}
