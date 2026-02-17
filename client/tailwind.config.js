/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#f0f0ff',
                    100: '#e0e0ff',
                    200: '#c7c4ff',
                    300: '#a59fff',
                    400: '#8b7aff',
                    500: '#7c5cfc',
                    600: '#6d3ef2',
                    700: '#5c30d6',
                    800: '#4c28ad',
                    900: '#3f2589',
                    950: '#261553',
                },
                glass: {
                    light: 'rgba(255, 255, 255, 0.15)',
                    medium: 'rgba(255, 255, 255, 0.25)',
                    heavy: 'rgba(255, 255, 255, 0.4)',
                    dark: 'rgba(0, 0, 0, 0.15)',
                    'dark-medium': 'rgba(0, 0, 0, 0.25)',
                },
                surface: {
                    50: '#fafafe',
                    100: '#f4f4fb',
                    200: '#e8e8f5',
                    800: '#1a1a2e',
                    850: '#151528',
                    900: '#0f0f23',
                    950: '#0a0a1a',
                },
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in-left': 'slideInLeft 0.3s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'fade-in': 'fadeIn 0.3s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'bounce-in': 'bounceIn 0.5s ease-out',
                float: 'float 3s ease-in-out infinite',
            },
            keyframes: {
                slideUp: {
                    from: { transform: 'translateY(20px)', opacity: '0' },
                    to: { transform: 'translateY(0)', opacity: '1' },
                },
                slideInLeft: {
                    from: { transform: 'translateX(-20px)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' },
                },
                slideInRight: {
                    from: { transform: 'translateX(20px)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
                bounceIn: {
                    '0%': { transform: 'scale(0.3)', opacity: '0' },
                    '50%': { transform: 'scale(1.05)' },
                    '70%': { transform: 'scale(0.9)' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
        },
    },
    plugins: [],
};
