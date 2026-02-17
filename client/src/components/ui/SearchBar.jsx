// client/src/components/ui/SearchBar.jsx
// Reusable search bar component

import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search...' }) {
    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="input-glass pl-10 pr-9 py-2.5 text-sm"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-60 transition-opacity"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
