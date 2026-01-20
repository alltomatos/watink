import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from "whaileys";
import Redis from "ioredis";

export const useRedisAuthState = async (
    redis: Redis,
    sessionId: number
): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {

    // Prefix for all keys associated with this session
    const keyPrefix = `wbot:auth:${sessionId}:`;

    // Helper to form the full key
    const getKey = (category: string, id: string) => `${keyPrefix}${category}:${id}`;

    // Load credentials (creds.json equivalent)
    const readCreds = async (): Promise<AuthenticationCreds> => {
        const credsStr = await redis.get(`${keyPrefix}creds`);
        if (credsStr) {
            return JSON.parse(credsStr, BufferJSON.reviver);
        }
        return initAuthCreds();
    };

    const creds = await readCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};

                    // Pipeline for performance
                    const pipeline = redis.pipeline();
                    ids.forEach(id => {
                        pipeline.get(getKey(type, id));
                    });

                    const results = await pipeline.exec();

                    ids.forEach((id, index) => {
                        const [err, val] = results![index];
                        if (val && typeof val === 'string') {
                            data[id] = JSON.parse(val, BufferJSON.reviver);
                        }
                    });

                    return data;
                },
                set: async (data) => {
                    const pipeline = redis.pipeline();

                    for (const category in data) {
                        for (const id in (data as any)[category]) {
                            const value = (data as any)[category][id];
                            const key = getKey(category, id);
                            if (value) {
                                pipeline.set(key, JSON.stringify(value, BufferJSON.replacer));
                            } else {
                                pipeline.del(key);
                            }
                        }
                    }

                    await pipeline.exec();
                }
            }
        },
        saveCreds: async () => {
            await redis.set(`${keyPrefix}creds`, JSON.stringify(creds, BufferJSON.replacer));
        }
    };
};
