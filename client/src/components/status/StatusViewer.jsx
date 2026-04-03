import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useStatusStore from '../../store/useStatusStore';
import AvatarFallback from '../ui/AvatarFallback';

const DURATION_MS = 5000;

export default function StatusViewer({ group, isOwn, onClose }) {
    const { markViewed, deleteStatus } = useStatusStore();
    const [index, setIndex] = useState(0);
    const [showViewers, setShowViewers] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const isProgressPaused = showViewers || showDeleteConfirm;

    const items = useMemo(() => group?.items || [], [group]);
    const activeItem = items[index];

    useEffect(() => {
        if (!activeItem) return;

        if (!isOwn && !activeItem.isViewed) {
            markViewed(activeItem._id);
        }

        if (isProgressPaused) {
            return undefined;
        }

        const timeout = window.setTimeout(() => {
            if (index < items.length - 1) {
                setIndex((current) => current + 1);
            } else {
                onClose();
            }
        }, DURATION_MS);

        return () => window.clearTimeout(timeout);
    }, [activeItem?._id, index, isOwn, isProgressPaused, items.length, markViewed, onClose]);

    if (!group || !activeItem) return null;

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            await deleteStatus(activeItem._id);
            toast.success('Status deleted');
            setShowDeleteConfirm(false);
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-md h-[100dvh] sm:h-[78vh] sm:max-h-[780px] rounded-none sm:rounded-[32px] overflow-hidden relative shadow-2xl border-0 sm:border border-white/10">
                <div
                    className="absolute inset-0"
                    style={{ background: activeItem.type === 'text' ? activeItem.background || '#7c5cfc' : '#050505' }}
                />

                {activeItem.type !== 'text' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {activeItem.type === 'video' ? (
                            <video src={activeItem.mediaUrl} autoPlay controls className="max-w-full max-h-full object-contain" />
                        ) : (
                            <img src={activeItem.mediaUrl} alt="" className="max-w-full max-h-full object-contain" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none" />
                    </div>
                )}

                <div className="absolute top-0 left-0 right-0 z-20 p-3 sm:p-4">
                    <div className="flex gap-1.5 mb-4">
                        {items.map((item, itemIndex) => (
                            <div key={item._id} className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden">
                                {itemIndex < index ? (
                                    <div className="h-full w-full bg-white" />
                                ) : itemIndex === index ? (
                                    <div
                                        key={`${item._id}-${index}`}
                                        className="h-full bg-white status-progress-fill"
                                        style={{
                                            animationDuration: `${DURATION_MS}ms`,
                                            animationPlayState: isProgressPaused ? 'paused' : 'running',
                                        }}
                                    />
                                ) : (
                                    <div className="h-full w-0 bg-white" />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/20">
                                {group.user.avatar ? (
                                    <img src={group.user.avatar} alt={group.user.name} className="w-full h-full object-cover" />
                                ) : (
                                    <AvatarFallback name={group.user.name} />
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">{group.user.name}</h3>
                                <p className="text-[11px] text-white/60">
                                    {new Date(activeItem.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {isOwn && (
                                <>
                                    <button onClick={() => setShowViewers((value) => !value)} className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setIndex((current) => Math.max(0, current - 1))}
                    disabled={index === 0}
                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 text-white disabled:opacity-30 hidden sm:inline-flex"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={() => index < items.length - 1 ? setIndex((current) => current + 1) : onClose()}
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 text-white hidden sm:inline-flex"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>

                <div className="absolute inset-0 z-10 flex items-center justify-center px-6 sm:px-8 py-24 pointer-events-none">
                    <div className="text-center max-w-[90%] sm:max-w-[80%]">
                        {activeItem.text && (
                            <p className="text-white text-xl sm:text-2xl leading-relaxed whitespace-pre-wrap break-words drop-shadow-lg">
                                {activeItem.text}
                            </p>
                        )}
                    </div>
                </div>

                {isOwn && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/35 text-white/80 text-xs flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        <span>{activeItem.viewersCount} viewed</span>
                    </div>
                )}

                {isOwn && showViewers && (
                    <div className="absolute left-3 right-3 sm:left-auto sm:right-4 bottom-20 z-30 sm:w-[260px] rounded-3xl bg-black/65 backdrop-blur-xl border border-white/10 p-4 text-white max-h-[40vh] sm:max-h-none">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Seen By</h4>
                            <span className="text-xs text-white/50">{activeItem.viewersCount}</span>
                        </div>
                        <div className="space-y-3 max-h-52 overflow-y-auto">
                            {(activeItem.viewers || []).length > 0 ? (
                                activeItem.viewers
                                    .slice()
                                    .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
                                    .map((viewer) => (
                                        <div key={`${viewer.userId}-${viewer.viewedAt}`} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="font-medium text-white/90">{viewer.name}</span>
                                            <span className="text-white/50">
                                                {new Date(viewer.viewedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))
                            ) : (
                                <p className="text-xs text-white/50">No views yet</p>
                            )}
                        </div>
                    </div>
                )}

                {isOwn && showDeleteConfirm && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
                        <div className="w-full max-w-xs rounded-3xl border border-white/10 bg-[#14141d]/90 p-5 text-white shadow-2xl">
                            <h4 className="text-base font-semibold">Delete status?</h4>
                            <p className="text-sm text-white/65 mt-2">
                                Are you sure you want to delete this status?
                            </p>
                            <div className="mt-5 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={handleDelete}
                                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
