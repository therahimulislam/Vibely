export const getNameInitials = (name = '') => {
    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';

    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const normalizeId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value._id) return normalizeId(value._id);
    return value.toString?.() || '';
};

export const getPreferredContactProfile = (currentUser, targetUserId) =>
    (currentUser?.contactProfiles || []).find((entry) => normalizeId(entry?.userId) === `${targetUserId}`) || null;

export const getDisplayName = (targetUser, currentUser = null) => {
    if (!targetUser) return '';

    const targetUserId = targetUser._id || targetUser.userId || '';
    const preferredFromProfile = currentUser && targetUserId
        ? getPreferredContactProfile(currentUser, targetUserId)?.preferredName
        : '';

    return (
        `${preferredFromProfile || targetUser.displayName || targetUser.preferredName || targetUser.name || ''}`.trim()
        || `${targetUser.username || 'Unknown'}`
    );
};
