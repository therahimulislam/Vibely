import { createPortal } from 'react-dom';
import { useEffect, useMemo } from 'react';
import { Check, Video, X } from 'lucide-react';

const formatFileSize = (size = 0) => {
    if (!size) return '0 MB';
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

export default function VideoPreviewModal({
    file,
    onCancel,
    onConfirm,
    title = 'Preview video',
    subtitle = 'Review your video before uploading',
    confirmLabel = 'Use video',
}) {
    const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

    useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="glass-card w-full max-w-2xl p-4 sm:p-5 max-h-[92dvh] overflow-y-auto">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <p className="text-xs opacity-50 mt-1">{subtitle}</p>
                    </div>
                    <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-60" />
                    </button>
                </div>

                <div className="rounded-3xl overflow-hidden bg-black/30 border border-white/10">
                    <video
                        src={previewUrl}
                        controls
                        className="w-full max-h-[68dvh] object-contain bg-black"
                    />
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Video className="w-5 h-5 text-primary-300" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file?.name || 'Video file'}</p>
                            <p className="text-xs opacity-50">Ready to attach</p>
                        </div>
                    </div>
                    <span className="text-xs opacity-55 flex-shrink-0">{formatFileSize(file?.size)}</span>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onCancel} className="btn-glass px-4 py-2 text-sm">Cancel</button>
                    <button onClick={() => onConfirm(file)} className="btn-primary px-4 py-2 text-sm">
                        <span className="flex items-center gap-2"><Check className="w-4 h-4" /> {confirmLabel}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
