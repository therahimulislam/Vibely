import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';

const OUTPUT_SIZE = 512;

const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

export default function AvatarCropModal({ file, onCancel, onConfirm }) {
    const [zoom, setZoom] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

    useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

    const handleConfirm = async () => {
        const image = await loadImage(previewUrl);
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');

        const cropSize = Math.min(image.width, image.height) / zoom;
        const maxOffsetX = Math.max(0, (image.width - cropSize) / 2);
        const maxOffsetY = Math.max(0, (image.height - cropSize) / 2);
        const sx = (image.width - cropSize) / 2 + (offsetX / 100) * maxOffsetX;
        const sy = (image.height - cropSize) / 2 + (offsetY / 100) * maxOffsetY;

        ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
            onConfirm(croppedFile);
        }, 'image/png', 0.92);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="glass-card w-full max-w-lg p-4 sm:p-5 max-h-[92dvh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold">Adjust profile photo</h3>
                        <p className="text-xs opacity-50 mt-1">Crop your avatar before uploading</p>
                    </div>
                    <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/5">
                        <X className="w-5 h-5 opacity-60" />
                    </button>
                </div>

                <div className="rounded-3xl overflow-hidden bg-black/30 aspect-square mb-4 relative">
                    <img
                        src={previewUrl}
                        alt="Crop preview"
                        className="w-full h-full object-cover"
                        style={{
                            transform: `scale(${zoom}) translate(${offsetX}px, ${offsetY}px)`,
                        }}
                    />
                    <div className="absolute inset-[12%] border-2 border-white/70 rounded-full pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>

                <div className="space-y-4">
                    <label className="block text-xs opacity-50">
                        Zoom
                        <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full mt-2" />
                    </label>
                    <label className="block text-xs opacity-50">
                        Horizontal
                        <input type="range" min="-100" max="100" step="1" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full mt-2" />
                    </label>
                    <label className="block text-xs opacity-50">
                        Vertical
                        <input type="range" min="-100" max="100" step="1" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full mt-2" />
                    </label>
                </div>

                <div className="flex justify-end gap-2 mt-5">
                    <button onClick={onCancel} className="btn-glass px-4 py-2 text-sm">Cancel</button>
                    <button onClick={handleConfirm} className="btn-primary px-4 py-2 text-sm">
                        <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Use photo</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
