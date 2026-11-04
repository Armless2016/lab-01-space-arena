import pino from 'pino';
/** Structured JSON logger. Sensitive request fields are redacted centrally. */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'space-arena-server' },
    redact: {
        paths: [
            'password', '*.password', 'token', '*.token', 'accessToken', '*.accessToken',
            'refreshToken', '*.refreshToken', 'apiKey', '*.apiKey', 'api_key', '*.api_key',
            'secret', '*.secret', 'secretKey', '*.secretKey', 'privateKey', '*.privateKey',
            'authorization', '*.authorization', 'cookie', '*.cookie',
            'req.headers.authorization', 'req.headers.cookie',
        ],
        censor: '[REDACTED]',
    },
    serializers: {
        err: pino.stdSerializers.err,
    },
});
