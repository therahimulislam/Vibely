import { useState, useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';
import { Laptop, Smartphone, Globe, Clock, Trash2, Shield, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

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

    const getDeviceIcon = (deviceType) => {
        if (deviceType?.toLowerCase().includes('mobile') || deviceType?.toLowerCase().includes('phone') || deviceType?.toLowerCase().includes('android') || deviceType?.toLowerCase().includes('ios')) {
            return <Smartphone className="w-6 h-6 text-blue-400" />;
        }
        return <Laptop className="w-6 h-6 text-purple-400" />;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Active Sessions</h1>
                    <p className="text-slate-400 text-sm">Manage your active devices and sessions</p>
                </div>
                {sessions.length > 1 && (
                    <button
                        onClick={handleRevokeAllOthers}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium border border-red-500/20"
                    >
                        <Shield className="w-4 h-4" />
                        Revoke All Others
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {sessions.map((session) => (
                    <div
                        key={session._id}
                        className={`relative p-5 rounded-xl border transition-all ${session.isCurrent
                                ? 'bg-indigo-500/5 border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.1)]'
                                : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-4">
                                <div className={`p-3 rounded-xl h-fit ${session.isCurrent ? 'bg-indigo-500/10' : 'bg-slate-700/30'
                                    }`}>
                                    {getDeviceIcon(session.device || session.os)}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-white text-lg">
                                            {session.browser} <span className="text-slate-500 font-normal">on</span> {session.os}
                                        </h3>
                                        {session.isCurrent && (
                                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/20 shadow-sm">
                                                Current Device
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1 text-sm text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-slate-500" />
                                            <span>{session.location && session.location !== 'Unknown' ? session.location : 'Unknown Location'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-500" />
                                            <span>{session.isCurrent ? 'Active now' : `Last active ${formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}`}</span>
                                        </div>
                                        <div className="text-xs font-mono text-slate-600 pt-1">
                                            IP: {session.ip}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!session.isCurrent && (
                                <button
                                    onClick={() => handleRevoke(session._id)}
                                    className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Revoke session"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {sessions.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-slate-500 bg-slate-800/20 rounded-xl border border-dashed border-slate-700">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No active sessions found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageSessions;
