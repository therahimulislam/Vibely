import { create } from 'zustand';

const STORAGE_KEY = 'theme';
const DARK_THEME_COLOR = '#0f1320';
const LIGHT_THEME_COLOR = '#eef2ff';

const getPreferredTheme = () => {
    if (typeof window === 'undefined') return 'dark';

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
        return saved;
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
};

const applyThemeToDocument = (theme) => {
    if (typeof document === 'undefined') return;

    const isDark = theme === 'dark';
    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle('dark', isDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    if (body) {
        body.classList.toggle('dark', isDark);
        body.style.colorScheme = theme;
    }

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
        themeMeta.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
    }

    const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusMeta) {
        appleStatusMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');
    }
};

const useThemeStore = create((set, get) => ({
    theme: getPreferredTheme(),

    initializeTheme: () => {
        const theme = getPreferredTheme();
        applyThemeToDocument(theme);
        set({ theme });
    },

    setTheme: (theme) => {
        const nextTheme = theme === 'light' ? 'light' : 'dark';
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, nextTheme);
        }
        applyThemeToDocument(nextTheme);
        set({ theme: nextTheme });
    },

    toggleTheme: () => {
        const currentTheme = get().theme;
        get().setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    },
}));

export default useThemeStore;
