// client/src/components/chat/ImagePreview.jsx
// Full-screen image lightbox

import { X, Download } from 'lucide-react';

export default function ImagePreview({ imageUrl, onClose }) {
    return (
        <div className="lightbox-overlay animate-fade-in" onClick={onClose}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img
                    src={imageUrl}
                    alt="Full size"
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl"
                />

                <div className="absolute top-3 right-3 flex gap-2">
                    <a
                        href={imageUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    >
                        <Download className="w-5 h-5" />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
