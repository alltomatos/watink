import Redis from "ioredis";
import { logger } from "../utils/logger";

export class RedisService {
    private static instance: RedisService;
    private client: Redis;

    private constructor() {
        this.client = new Redis(process.env.REDIS_URI || process.env.REDIS_URL || "redis://redis:6379");

        this.client.on("connect", () => {
            logger.info("RedisService: Connected to Redis");
        });

        this.client.on("error", (err) => {
            logger.error(`RedisService Error: ${err}`);
        });
    }

    public static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    public getClient(): Redis {
        return this.client;
    }

    public async getValue(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    public async setValue(key: string, value: string, mode?: "EX", duration?: number): Promise<string | null> {
        if (mode && duration) {
            return this.client.set(key, value, mode, duration);
        }
        return this.client.set(key, value);
    }

    public async delValue(key: string | string[]): Promise<number> {
        if (Array.isArray(key)) {
            if (key.length === 0) return 0;
            return this.client.del(...key);
        }
        return this.client.del(key);
    }

    public async getKeys(pattern: string): Promise<string[]> {
        return this.client.keys(pattern);
    }

    // Lock implementation: SET key value NX EX duration
    public async setNx(key: string, value: string, durationSeconds: number): Promise<boolean> {
        const result = await this.client.set(key, value, "EX", durationSeconds, "NX");
        return result === "OK";
    }

    public async info(): Promise<string> {
        return this.client.info();
    }
}
