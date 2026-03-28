export const CHAT_THEME_PRESETS = {
    aurora: {
        id: 'aurora',
        label: 'Aurora',
        description: 'Electric violet with cool cyan highlights',
        preview: 'linear-gradient(135deg, #6f6bff 0%, #8d4dff 45%, #00c2ff 100%)',
        variables: {
            '--gradient-primary': 'linear-gradient(135deg, #6f6bff 0%, #8d4dff 45%, #00c2ff 100%)',
            '--gradient-accent': 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
            '--gradient-sent': 'linear-gradient(135deg, #6d63ff 0%, #7c4dff 52%, #9d6bff 100%)',
            '--gradient-bg-dark': 'radial-gradient(circle at top left, rgba(111, 107, 255, 0.22), transparent 26%), radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 24%), linear-gradient(145deg, #080a12 0%, #0f1320 42%, #141b2a 100%)',
            '--gradient-bg-light': 'radial-gradient(circle at top left, rgba(111, 107, 255, 0.14), transparent 28%), radial-gradient(circle at top right, rgba(34, 211, 238, 0.10), transparent 22%), linear-gradient(145deg, #f5f7fb 0%, #eef2ff 42%, #e8edf7 100%)',
        },
    },
    ocean: {
        id: 'ocean',
        label: 'Ocean',
        description: 'Deep blue with aquatic glow',
        preview: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 50%, #14b8a6 100%)',
        variables: {
            '--gradient-primary': 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 50%, #14b8a6 100%)',
            '--gradient-accent': 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
            '--gradient-sent': 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 48%, #14b8a6 100%)',
            '--gradient-bg-dark': 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 26%), radial-gradient(circle at top right, rgba(20, 184, 166, 0.14), transparent 24%), linear-gradient(145deg, #07111a 0%, #0b1825 42%, #0f2230 100%)',
            '--gradient-bg-light': 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 28%), radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 22%), linear-gradient(145deg, #f2fbff 0%, #e6f4fb 42%, #e3f5f2 100%)',
        },
    },
    ember: {
        id: 'ember',
        label: 'Ember',
        description: 'Warm sunset tones with premium contrast',
        preview: 'linear-gradient(135deg, #f97316 0%, #ef4444 52%, #fb7185 100%)',
        variables: {
            '--gradient-primary': 'linear-gradient(135deg, #f97316 0%, #ef4444 52%, #fb7185 100%)',
            '--gradient-accent': 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
            '--gradient-sent': 'linear-gradient(135deg, #f97316 0%, #ef4444 55%, #fb7185 100%)',
            '--gradient-bg-dark': 'radial-gradient(circle at top left, rgba(249, 115, 22, 0.18), transparent 26%), radial-gradient(circle at top right, rgba(251, 113, 133, 0.14), transparent 24%), linear-gradient(145deg, #130a09 0%, #1d1111 42%, #24151c 100%)',
            '--gradient-bg-light': 'radial-gradient(circle at top left, rgba(249, 115, 22, 0.12), transparent 28%), radial-gradient(circle at top right, rgba(251, 113, 133, 0.11), transparent 22%), linear-gradient(145deg, #fff8f4 0%, #fff1ee 42%, #fff1f6 100%)',
        },
    },
    forest: {
        id: 'forest',
        label: 'Forest',
        description: 'Emerald tones with natural depth',
        preview: 'linear-gradient(135deg, #059669 0%, #22c55e 50%, #84cc16 100%)',
        variables: {
            '--gradient-primary': 'linear-gradient(135deg, #059669 0%, #22c55e 50%, #84cc16 100%)',
            '--gradient-accent': 'linear-gradient(135deg, #047857 0%, #65a30d 100%)',
            '--gradient-sent': 'linear-gradient(135deg, #059669 0%, #16a34a 50%, #84cc16 100%)',
            '--gradient-bg-dark': 'radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 26%), radial-gradient(circle at top right, rgba(132, 204, 22, 0.12), transparent 24%), linear-gradient(145deg, #09120d 0%, #0d1713 42%, #142019 100%)',
            '--gradient-bg-light': 'radial-gradient(circle at top left, rgba(34, 197, 94, 0.11), transparent 28%), radial-gradient(circle at top right, rgba(132, 204, 22, 0.10), transparent 22%), linear-gradient(145deg, #f5fff8 0%, #edf9ef 42%, #f4fae8 100%)',
        },
    },
};

export const DEFAULT_CHAT_THEME = 'aurora';

export const applyChatThemePreset = (presetId = DEFAULT_CHAT_THEME) => {
    if (typeof document === 'undefined') return;

    const preset = CHAT_THEME_PRESETS[presetId] || CHAT_THEME_PRESETS[DEFAULT_CHAT_THEME];
    Object.entries(preset.variables).forEach(([variable, value]) => {
        document.documentElement.style.setProperty(variable, value);
    });
};
