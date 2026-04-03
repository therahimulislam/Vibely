import { ArrowLeft, ChevronRight, Eye, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AvatarFallback from '../ui/AvatarFallback';
import { getDisplayName } from '../../utils/userDisplay';

const formatRelativeTime = (value) => {
    if (!value) return 'No updates yet';
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true });
    } catch {
        return 'just now';
    }
};

const getStatusPreview = (item) => {
    if (!item) return 'No status yet';
    if (item.type === 'video') return item.text || 'Video status';
    if (item.type === 'image') return item.text || 'Photo status';
    return item.text || 'Text status';
};

const StatusListItem = ({ user, latestItem, latestAt, hasUnviewed, count, label, onClick, trailingAction }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full rounded-[24px] border border-white/8 bg-white/5 px-4 py-4 text-left hover:bg-white/8 hover:border-primary-400/20 transition-all"
    >
        <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full p-[3px] flex-shrink-0 ${hasUnviewed ? 'bg-gradient-to-br from-[#25d366] via-[#7c5cfc] to-[#f59f00]' : 'bg-white/10'}`}>
                <div className="w-full h-full rounded-full bg-[rgba(10,12,20,0.92)] overflow-hidden flex items-center justify-center">
                    {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <AvatarFallback name={user?.name} className="text-sm" />
                    )}
                </div>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{label || user?.name || 'Status'}</p>
                    {hasUnviewed && (
                        <span className="badge-pill !bg-primary-500/15 !text-primary-200">
                            New
                        </span>
                    )}
                    {count > 1 && (
                        <span className="badge-pill">{count} updates</span>
                    )}
                </div>
                <p className="text-xs opacity-45 mt-1 truncate">{getStatusPreview(latestItem)}</p>
                <p className="text-[11px] opacity-35 mt-1">{formatRelativeTime(latestAt)}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {trailingAction}
                <ChevronRight className="w-4 h-4 opacity-35" />
            </div>
        </div>
    </button>
);

export default function StatusPage({
    user,
    myStatuses,
    statuses,
    isLoading,
    onCreate,
    onOpenGroup,
    onRefresh,
    onBack,
}) {
    const safeStatuses = Array.isArray(statuses) ? statuses.filter((group) => group?.user?._id) : [];
    const latestMyStatus = myStatuses?.items?.[0] || null;

    return (
        <div className="flex-1 min-h-0 surface-elevated rounded-[28px] overflow-hidden">
            <div className="h-full overflow-y-auto">
                <div className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b border-white/6 backdrop-blur-xl bg-[rgba(10,12,20,0.46)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={onBack}
                                className="md:hidden p-2 rounded-xl hover:bg-white/5"
                                title="Back"
                            >
                                <ArrowLeft className="w-4 h-4 opacity-60" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="badge-pill"><Sparkles className="w-3.5 h-3.5" /> 24h updates</span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-semibold leading-none">Status</h2>
                                <p className="text-xs opacity-45 mt-2">Share quick moments and catch up on contact updates in one place.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="icon-button !w-10 !h-10"
                                title="Refresh statuses"
                            >
                                <RefreshCw className="w-4 h-4 opacity-60" />
                            </button>
                            <button
                                type="button"
                                onClick={onCreate}
                                className="btn-primary px-4 py-2.5 text-sm"
                            >
                                <span className="flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    New Status
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                    <section className="glass-card rounded-[28px] p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] opacity-35 mb-1">Your updates</p>
                                <h3 className="text-base sm:text-lg font-semibold">My Status</h3>
                            </div>
                            {myStatuses?.items?.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onOpenGroup(myStatuses, true)}
                                    className="btn-glass px-3 py-2 text-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        View
                                    </span>
                                </button>
                            )}
                        </div>

                        <StatusListItem
                            user={user}
                            label="Your status"
                            latestItem={latestMyStatus}
                            latestAt={myStatuses?.latestAt || latestMyStatus?.createdAt || null}
                            hasUnviewed={!!myStatuses?.items?.length}
                            count={myStatuses?.items?.length || 0}
                            onClick={() => myStatuses?.items?.length ? onOpenGroup(myStatuses, true) : onCreate()}
                            trailingAction={
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCreate();
                                    }}
                                    className="w-9 h-9 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow-[0_14px_30px_rgba(37,211,102,0.22)]"
                                    title="Add status"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            }
                        />
                    </section>

                    <section className="glass-card rounded-[28px] p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] opacity-35 mb-1">Recent updates</p>
                                <h3 className="text-base sm:text-lg font-semibold">Contact Status</h3>
                            </div>
                            <span className="badge-pill">{safeStatuses.length}</span>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
                            </div>
                        ) : safeStatuses.length > 0 ? (
                            <div className="space-y-3">
                                {safeStatuses.map((group) => (
                                    <StatusListItem
                                        key={group.user._id}
                                        user={group.user}
                                        label={getDisplayName(group.user, user)}
                                        latestItem={group.items?.[0]}
                                        latestAt={group.latestAt}
                                        hasUnviewed={group.hasUnviewed}
                                        count={group.items?.length || 0}
                                        onClick={() => onOpenGroup(group, false)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-5 py-8 text-center">
                                <p className="text-base font-semibold mb-2">No recent statuses yet</p>
                                <p className="text-sm opacity-50 max-w-sm mx-auto leading-6">
                                    Once contacts share updates, they will appear here with unread highlights just like a dedicated status feed.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
