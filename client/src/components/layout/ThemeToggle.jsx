// client/src/components/layout/ThemeToggle.jsx
// Theme toggle button component

import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
    const isDark = document.documentElement.classList.contains('dark');

    return (
        <button
            onClick={() => window.__toggleTheme?.()}
            className="p-2 rounded-xl hover:bg-white/5 transition-all duration-200"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
            ) : (
                <Moon className="w-5 h-5 text-primary-500" />
            )}
        </button>
    );
}
