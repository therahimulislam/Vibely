import { Plus, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AvatarFallback from '../ui/AvatarFallback';

const formatTime = (date) => {
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
        return 'just now';
    }
};

const StatusAvatar = ({ user, hasUnviewed, onClick, label }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 min-w-[68px] sm:min-w-[76px] text-center flex-shrink-0">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[3px] ${hasUnviewed ? 'bg-gradient-to-br from-[#25d366] via-[#7c5cfc] to-[#f59f00]' : 'bg-white/10'}`}>
            <div className="w-full h-full rounded-full bg-[#161622] overflow-hidden flex items-center justify-center">
                {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                    <AvatarFallback name={user?.name} className="text-sm" />
                )}
            </div>
        </div>
        <div className="space-y-0.5">
            <p className="text-[11px] sm:text-xs font-medium truncate max-w-[68px] sm:max-w-[76px]">{label || user?.name}</p>
            {user?.latestAt && <p className="text-[10px] opacity-45">{formatTime(user.latestAt)}</p>}
        </div>
    </button>
);

export default function StatusStrip({ user, myStatuses, statuses, isLoading, onCreate, onOpenGroup }) {
    return (
        <div className="px-3 sm:px-4 pb-4 flex-shrink-0">
            <div className="glass-card rounded-3xl p-3 sm:p-3.5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-2xl bg-white/10 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-primary-300" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold">Status</h3>
                            <p className="text-[11px] opacity-45">Share moments that vanish in 24h</p>
                        </div>
                    </div>
                    <button onClick={onCreate} className="p-2 rounded-xl hover:bg-white/5" title="Create status">
                        <Plus className="w-4 h-4 opacity-65" />
                    </button>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                    <div className="relative">
                        <StatusAvatar
                            user={user}
                            hasUnviewed={!!myStatuses?.items?.length}
                            onClick={() => myStatuses?.items?.length ? onOpenGroup(myStatuses, true) : onCreate()}
                            label="Your status"
                        />
                        <button
                            onClick={onCreate}
                            className="absolute right-1 top-10 w-6 h-6 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow-lg"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {isLoading && (
                        <div className="flex items-center px-3 text-xs opacity-50">Loading...</div>
                    )}

                    {statuses.map((group) => (
                        <StatusAvatar
                            key={group.user._id}
                            user={{ ...group.user, latestAt: group.latestAt }}
                            hasUnviewed={group.hasUnviewed}
                            onClick={() => onOpenGroup(group, false)}
                        />
                    ))}

                    {!isLoading && statuses.length === 0 && (
                        <div className="flex items-center px-3 text-xs opacity-45">
                            No recent statuses from your contacts yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
