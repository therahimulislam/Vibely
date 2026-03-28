import { getNameInitials } from '../../utils/userDisplay';

const AVATAR_PALETTES = [
    ['#5b8def', '#7c5cfc'],
    ['#00a896', '#02c39a'],
    ['#ff7a59', '#ffb347'],
    ['#f72585', '#b5179e'],
    ['#4361ee', '#4cc9f0'],
    ['#2a9d8f', '#264653'],
];

const getPaletteIndex = (name = '') => {
    return Array.from(String(name)).reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_PALETTES.length;
};

export default function AvatarFallback({ name, className = '', icon = null, variant = 'person' }) {
    const [fromColor, toColor] = variant === 'group'
        ? ['#7c5cfc', '#5c30d6']
        : AVATAR_PALETTES[getPaletteIndex(name)];

    return (
        <div
            className={`w-full h-full flex items-center justify-center text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${className}`}
            style={{
                background: `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`,
            }}
        >
            {icon || getNameInitials(name)}
        </div>
    );
}
