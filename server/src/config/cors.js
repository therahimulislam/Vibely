const normalizeOrigin = (origin = '') => origin.trim().replace(/\/+$/, '');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardToRegex = (pattern) => {
    const normalizedPattern = normalizeOrigin(pattern);
    if (!normalizedPattern.includes('*')) return null;

    const expression = `^${normalizedPattern.split('*').map(escapeRegex).join('.*')}$`;
    return new RegExp(expression);
};

const parseAllowedOrigins = () => {
    const configuredOrigins = [
        process.env.CLIENT_URL,
        process.env.CLIENT_URLS,
    ]
        .filter(Boolean)
        .flatMap((value) => value.split(','))
        .map(normalizeOrigin)
        .filter(Boolean);

    return configuredOrigins.length > 0
        ? Array.from(new Set(configuredOrigins))
        : ['http://localhost:5173'];
};

const configuredOrigins = parseAllowedOrigins();
const exactOrigins = configuredOrigins.filter((origin) => !origin.includes('*'));
const wildcardOrigins = configuredOrigins
    .filter((origin) => origin.includes('*'))
    .map((origin) => ({
        pattern: origin,
        regex: wildcardToRegex(origin),
    }))
    .filter((entry) => entry.regex);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const normalizedOrigin = normalizeOrigin(origin);

    if (exactOrigins.includes(normalizedOrigin)) {
        return true;
    }

    return wildcardOrigins.some(({ regex }) => regex.test(normalizedOrigin));
};

const corsOrigin = (origin, callback) => {
    if (isAllowedOrigin(origin)) {
        return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

module.exports = {
    allowedOrigins: configuredOrigins,
    corsOrigin,
};
