// client/src/utils/formatters.js
// Date and time formatting utilities

export const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatLastSeen = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return formatDate(date);
};

export const formatMessagePreview = (text, maxLength = 40) => {
    if (!text) return 'Photo';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};
