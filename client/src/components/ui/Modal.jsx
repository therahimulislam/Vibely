// client/src/components/ui/Modal.jsx
// Reusable modal component

import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="glass-card p-6 max-w-md w-full relative z-10 animate-bounce-in"
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">{title}</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
                            <X className="w-5 h-5 opacity-50" />
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
