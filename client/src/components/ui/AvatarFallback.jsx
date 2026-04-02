import { getNameInitials } from '../../utils/userDisplay';

// Richer 8-palette system seeded by name — each palette is a stop pair for a 135° gradient
const AVATAR_PALETTES = [
  ['#6f6bff', '#a855f7'],  // indigo → violet
  ['#06b6d4', '#6f6bff'],  // cyan → indigo
  ['#10b981', '#059669'],  // emerald tones
  ['#f97316', '#ef4444'],  // orange → red
  ['#ec4899', '#a855f7'],  // pink → violet
  ['#3b82f6', '#06b6d4'],  // blue → cyan
  ['#84cc16', '#10b981'],  // lime → emerald
  ['#f59e0b', '#f97316'],  // amber → orange
];

const getPaletteIndex = (name = '') =>
  Array.from(String(name)).reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_PALETTES.length;

export default function AvatarFallback({ name, className = '', icon = null, variant = 'person' }) {
  const [from, to] = variant === 'group'
    ? ['#7c6dff', '#9d4edd']
    : variant === 'saved'
      ? ['#06b6d4', '#6f6bff']
      : AVATAR_PALETTES[getPaletteIndex(name)];

  return (
    <div
      className={`w-full h-full flex items-center justify-center text-white font-bold select-none ${className}`}
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.12)',
        textShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {icon || getNameInitials(name)}
    </div>
  );
}
