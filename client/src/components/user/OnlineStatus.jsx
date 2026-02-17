// client/src/components/user/OnlineStatus.jsx
// Online/offline status indicator with last seen

import { formatLastSeen } from '../../utils/formatters';

export default function OnlineStatus({ isOnline, lastSeen }) {
    if (isOnline) {
        return (
            <span className="flex items-center gap-1.5 text-xs">
                <span className="status-online" />
                <span className="text-green-400">Online</span>
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-xs opacity-50">
            <span className="status-offline" />
            <span>Last seen {formatLastSeen(lastSeen)}</span>
        </span>
    );
}
