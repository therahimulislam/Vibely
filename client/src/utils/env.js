const DEFAULT_API_URL = 'http://localhost:5000/api';
const DEFAULT_SOCKET_URL = 'http://localhost:5000';

const safeParseUrl = (value) => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

export const normalizeApiUrl = (value) => {
    const rawValue = (value || '').trim();
    if (!rawValue) return DEFAULT_API_URL;

    const parsed = safeParseUrl(rawValue);
    if (!parsed) return rawValue.replace(/\/+$/, '');

    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    if (!parsed.pathname || parsed.pathname === '/') {
        parsed.pathname = '/api';
    } else if (!parsed.pathname.endsWith('/api')) {
        parsed.pathname = `${parsed.pathname}/api`.replace(/\/{2,}/g, '/');
    }

    return parsed.toString().replace(/\/+$/, '');
};

export const normalizeSocketUrl = (value, apiUrl = DEFAULT_API_URL) => {
    const rawValue = (value || '').trim();
    if (rawValue) {
        return rawValue.replace(/\/+$/, '');
    }

    const parsed = safeParseUrl(apiUrl);
    if (!parsed) return DEFAULT_SOCKET_URL;

    parsed.pathname = parsed.pathname.replace(/\/api\/?$/, '') || '/';
    return parsed.toString().replace(/\/+$/, '');
};
