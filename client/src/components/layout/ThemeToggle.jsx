// client/src/components/layout/ThemeToggle.jsx
// Theme toggle button component

import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../../store/useThemeStore';

export default function ThemeToggle() {
    const theme = useThemeStore((state) => state.theme);
    const toggleTheme = useThemeStore((state) => state.toggleTheme);
    const isDark = theme === 'dark';

    return (
        <button
            onClick={toggleTheme}
            className="icon-button !w-10 !h-10 sm:!w-[42px] sm:!h-[42px]"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to day mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
            ) : (
                <Moon className="w-5 h-5 text-primary-500" />
            )}
        </button>
    );
}
