import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Sparkles, Type, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useStatusStore from '../../store/useStatusStore';
import AvatarCropModal from '../user/AvatarCropModal';

const BACKGROUNDS = [
    'linear-gradient(135deg, #ff6b6b 0%, #f06595 100%)',
    'linear-gradient(135deg, #7c5cfc 0%, #5c30d6 100%)',
    'linear-gradient(135deg, #00b894 0%, #0984e3 100%)',
    'linear-gradient(135deg, #f59f00 0%, #f76707 100%)',
];

export default function StatusComposerModal({ onClose }) {
    const { createStatus } = useStatusStore();
    const [text, setText] = useState('');
    const [background, setBackground] = useState(BACKGROUNDS[0]);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [pendingImageFile, setPendingImageFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isImageFile = (selectedFile) =>
        !!selectedFile && (selectedFile.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(selectedFile.name));
    const isVideoFile = (selectedFile) =>
        !!selectedFile && (selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(selectedFile.name));

    const previewType = useMemo(() => {
        if (!file) return 'text';
        return isVideoFile(file) ? 'video' : 'image';
    }, [file]);

    useEffect(() => () => {
        if (preview?.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
    }, [preview]);

    const applySelectedFile = (selectedFile) => {
        if (preview?.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
    };

    const clearSelectedFile = () => {
        if (preview?.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
        setFile(null);
        setPreview('');
    };

    const handleSelectFile = (event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;

        if (selected.size > 25 * 1024 * 1024) {
            toast.error('Status media must be under 25MB');
            return;
        }

        if (isImageFile(selected) || isVideoFile(selected)) {
            applySelectedFile(selected);
        } else {
            applySelectedFile(selected);
        }

        event.target.value = '';
    };

    const handleSubmit = async () => {
        if (!text.trim() && !file) {
            toast.error('Add text or media to post a status');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('text', text.trim());
            formData.append('background', background);
            if (file) {
                formData.append('media', file);
            }

            await createStatus(formData);
            toast.success('Status posted');
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
                <div className="glass-card w-full max-w-xl p-4 sm:p-5 max-h-[92dvh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">Create Status</h3>
                            <p className="text-xs opacity-50 mt-1">Visible for 24 hours</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                            <X className="w-5 h-5 opacity-60" />
                        </button>
                    </div>

                    <div
                        className="rounded-3xl p-4 sm:p-5 min-h-[220px] sm:min-h-[260px] border border-white/10 flex flex-col justify-between"
                        style={{ background }}
                    >
                        {preview ? (
                            <div className="flex-1 min-h-[240px] flex items-center justify-center overflow-hidden rounded-2xl bg-black/20 border border-white/10 p-2">
                                {previewType === 'video' ? (
                                    <video key={preview} src={preview} controls autoPlay muted loop playsInline className="max-w-full max-h-[340px] object-contain rounded-2xl bg-black" />
                                ) : (
                                    <img key={preview} src={preview} alt="Status preview" className="block max-w-full max-h-[340px] object-contain rounded-2xl bg-black/20" />
                                )}
                            </div>
                        ) : (
                            <textarea
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Type a status..."
                                className="w-full flex-1 bg-transparent text-white text-xl sm:text-2xl leading-relaxed resize-none outline-none placeholder:text-white/60"
                            />
                        )}

                        {preview && (
                            <textarea
                                value={text}
                                onChange={(event) => setText(event.target.value)}
                                placeholder="Add a caption..."
                                className="w-full mt-4 bg-black/20 text-white rounded-2xl px-4 py-3 resize-none outline-none placeholder:text-white/60"
                                rows={3}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                        {BACKGROUNDS.map((item) => (
                            <button
                                key={item}
                                onClick={() => setBackground(item)}
                                className={`w-10 h-10 rounded-2xl border-2 flex-shrink-0 ${background === item ? 'border-white' : 'border-transparent'}`}
                                style={{ background: item }}
                            />
                        ))}
                        <label className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center cursor-pointer flex-shrink-0">
                            <ImagePlus className="w-5 h-5 opacity-70" />
                            <input type="file" accept="image/*,video/*" onChange={handleSelectFile} className="hidden" />
                        </label>
                        {preview && previewType === 'image' && (
                            <button
                                type="button"
                                onClick={() => setPendingImageFile(file)}
                                className="px-3 h-10 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/85 text-sm flex items-center justify-center flex-shrink-0"
                            >
                                Crop
                            </button>
                        )}
                        {preview && (
                            <button
                                type="button"
                                onClick={clearSelectedFile}
                                className="px-3 h-10 rounded-2xl bg-red-500/15 hover:bg-red-500/20 border border-red-400/20 text-red-200 text-sm flex items-center justify-center flex-shrink-0"
                            >
                                Remove
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5">
                        <div className="flex flex-wrap items-center gap-3 text-xs opacity-55">
                            <span className="flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Text</span>
                            <span className="flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Photo</span>
                            <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video</span>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="btn-primary px-5 py-2.5 disabled:opacity-50"
                        >
                            <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                {isSubmitting ? 'Posting...' : 'Post Status'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {pendingImageFile && (
                <AvatarCropModal
                    file={pendingImageFile}
                    src={preview}
                    onCancel={() => setPendingImageFile(null)}
                    onConfirm={(croppedFile) => {
                        setPendingImageFile(null);
                        applySelectedFile(croppedFile);
                    }}
                    title="Adjust status photo"
                    subtitle="Preview and crop your status before posting"
                    confirmLabel="Use in status"
                    outputWidth={1080}
                    outputHeight={1920}
                    outputMimeType="image/jpeg"
                    outputQuality={0.92}
                    maskShape="rounded"
                    flexible={true}
                />
            )}
        </>,
        document.body
    );
}
