import { useState, useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { Smartphone, Monitor, X, Shield, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ThemeToggle from '../components/layout/ThemeToggle';

const ManageSessions = () => {
    const { getSessions, revokeSession, revokeAllOtherSessions } = useAuthStore();
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadSessions = async () => {
            try {
                setIsLoading(true);
                const data = await getSessions();
                setSessions(data || []);
            } catch (error) {
                toast.error('Failed to load sessions');
            } finally {
                setIsLoading(false);
            }
        };
        loadSessions();
    }, [getSessions]);

    const handleRevoke = async (sessionId) => {
        if (!confirm('Are you sure you want to revoke this session?')) return;

        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter(s => s._id !== sessionId));
            toast.success('Session revoked');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleRevokeAllOthers = async () => {
        if (!confirm('Are you sure you want to log out from all other devices?')) return;

        try {
            await revokeAllOtherSessions();
            setSessions(sessions.filter(s => s.isCurrent));
            toast.success('All other sessions revoked');
        } catch (error) {
            toast.error(error.message);
        }
    };

    const getDeviceIcon = (deviceType, os) => {
        const type = deviceType?.toLowerCase() || '';
        const osName = os?.toLowerCase() || '';

        if (type.includes('mobile') || type.includes('phone') || osName.includes('android') || osName.includes('ios')) {
            return <Smartphone className="w-6 h-6 text-primary-400" />;
        }
        return <Monitor className="w-6 h-6 text-primary-400" />;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
            <div className="flex justify-end">
                <ThemeToggle />
            </div>
            <div>
                <h1 className="text-xl font-bold mb-6 tracking-wide">ACTIVE DEVICES</h1>

                <div className="space-y-4">
                    {sessions.map((session) => (
                        <div
                            key={session._id}
                            className="glass-card rounded-2xl p-4 flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                    {getDeviceIcon(session.device, session.os)}
                                </div>

                                <div>
                                    <h3 className="font-medium text-base flex items-center gap-3 flex-wrap">
                                        {session.os || 'Unknown OS'}
                                        {session.isCurrent && (
                                            <div className="flex items-center gap-1.5 bg-[#2ecc71]/20 px-2 py-0.5 rounded text-[10px] font-bold text-[#2ecc71] uppercase tracking-wider">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]"></div>
                                                This device
                                            </div>
                                        )}
                                    </h3>
                                    <div className="text-sm opacity-60 mt-0.5 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span>{session.browser}</span>
                                            <span className="opacity-30">•</span>
                                            <span>{session.location && session.location !== 'Unknown' ? session.location : 'Unknown Location'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs opacity-50">
                                            {session.isCurrent ? (
                                                <span className="text-[#2ecc71]">Active now</span>
                                            ) : (
                                                <span>Last active {format(new Date(session.lastActive), 'MMM dd, hh:mm a')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!session.isCurrent && (
                                <button
                                    onClick={() => handleRevoke(session._id)}
                                    className="p-2 opacity-50 hover:opacity-100 hover:bg-white/10 rounded-full transition-colors"
                                    title="Revoke session"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {sessions.length > 1 && (
                <button
                    onClick={handleRevokeAllOthers}
                    className="w-full py-4 border border-red-500/50 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors font-medium flex items-center justify-center gap-2"
                >
                    Logout from all other devices
                </button>
            )}
        </div>
    );
};

export default ManageSessions;
