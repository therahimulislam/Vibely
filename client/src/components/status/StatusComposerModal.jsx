import { useMemo, useState } from 'react';
import { ImagePlus, Sparkles, Type, Video, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useStatusStore from '../../store/useStatusStore';

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const previewType = useMemo(() => {
        if (!file) return 'text';
        return file.type.startsWith('video/') ? 'video' : 'image';
    }, [file]);

    const handleSelectFile = (event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;

        if (selected.size > 25 * 1024 * 1024) {
            toast.error('Status media must be under 25MB');
            return;
        }

        setFile(selected);
        setPreview(URL.createObjectURL(selected));
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

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
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
                        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-black/20">
                            {previewType === 'video' ? (
                                <video src={preview} controls className="max-h-[260px] rounded-2xl" />
                            ) : (
                                <img src={preview} alt="Status preview" className="max-h-[260px] rounded-2xl object-cover" />
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
    );
}
