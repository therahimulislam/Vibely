// client/src/components/user/UserAvatar.jsx
// Reusable user avatar component

import AvatarFallback from '../ui/AvatarFallback';

export default function UserAvatar({ user, size = 'md', showOnline = false }) {
    const sizes = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-14 h-14 text-lg',
        xl: 'w-20 h-20 text-2xl',
    };

    return (
        <div className="relative inline-block">
            <div className={`${sizes[size]} rounded-full overflow-hidden`}>
                {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                    <AvatarFallback name={user?.name} className="text-inherit" />
                )}
            </div>
            {showOnline && user?.isOnline && (
                <div className="absolute bottom-0 right-0 status-online border-2 border-surface-900" />
            )}
        </div>
    );
}
