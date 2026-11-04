import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const booleanEnv = z.preprocess((value) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value !== 'string')
        return value;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true')
        return true;
    if (normalized === 'false')
        return false;
    return value;
}, z.boolean());
const csvOrigins = z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim() === '')
        return localOrigins;
    return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}, z.array(z.string().url().refine((origin) => {
    try {
        return new URL(origin).origin === origin;
    }
    catch {
        return false;
    }
}, 'Origin must not contain a path')));
const environmentSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.preprocess((value) => value === undefined || value === '' ? 3000 : Number(value), z.number().int().min(1).max(65535)),
    WS_MAX_PAYLOAD: z.preprocess((value) => value === undefined || value === '' ? 16 * 1024 : Number(value), z.number().int().min(1024).max(1024 * 1024)),
    MAX_MESSAGES_PER_SECOND: z.preprocess((value) => value === undefined || value === '' ? 120 : Number(value), z.number().int().min(1).max(1000)),
    MAX_CONNECTIONS_PER_IP: z.preprocess((value) => value === undefined || value === '' ? 32 : Number(value), z.number().int().min(1).max(1000)),
    MAX_ROOMS: z.preprocess((value) => value === undefined || value === '' ? 100 : Number(value), z.number().int().min(1).max(10_000)),
    MAX_PLAYERS_PER_ROOM: z.preprocess((value) => value === undefined || value === '' ? 16 : Number(value), z.number().int().min(1).max(128)),
    ALLOWED_ORIGINS: csvOrigins,
    ALLOW_MISSING_ORIGIN: booleanEnv.default(false),
    TRUST_PROXY: booleanEnv.default(false),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    BUILD_SHA: z.string().trim().min(1).default('dev'),
    LOG_DIR: z.string().default('./server/logs'),
    CLIENT_DIST_DIR: z.string().default('./client/dist'),
}).superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS.some((origin) => !origin.startsWith('https://') || localOrigins.includes(origin))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['ALLOWED_ORIGINS'], message: 'Production ALLOWED_ORIGINS must contain only deployed HTTPS origins' });
    }
});
function isMissingFile(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
export function loadConfig() {
    if (typeof process.loadEnvFile === 'function') {
        try {
            process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
        }
        catch (error) {
            if (!isMissingFile(error))
                throw error;
        }
    }
    const env = environmentSchema.parse(process.env);
    return {
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
        wsMaxPayload: env.WS_MAX_PAYLOAD,
        maxMessagesPerSecond: env.MAX_MESSAGES_PER_SECOND,
        maxConnectionsPerIp: env.MAX_CONNECTIONS_PER_IP,
        maxRooms: env.MAX_ROOMS,
        maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
        allowedOrigins: env.ALLOWED_ORIGINS,
        allowMissingOrigin: env.ALLOW_MISSING_ORIGIN || env.NODE_ENV !== 'production',
        trustProxy: env.TRUST_PROXY,
        logLevel: env.LOG_LEVEL,
        buildSha: env.BUILD_SHA,
        logDir: path.resolve(PROJECT_ROOT, env.LOG_DIR),
        clientDistDir: path.resolve(PROJECT_ROOT, env.CLIENT_DIST_DIR),
    };
}
