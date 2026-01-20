import { RedisService } from "../RedisService";
import { logger } from "../../utils/logger";

// Redis key prefixes
const REDIS_USER_ONLINE_PREFIX = "user:online:";
const REDIS_USER_SOCKETS_PREFIX = "user:sockets:";
const ONLINE_TTL_SECONDS = 3600; // 1 hour safety TTL to prevent "ghosts"

/**
 * UserOnlineService
 * 
 * Manages user online/offline status in Redis for real-time
 * distribution of tickets. Handles multiple tabs/connections
 * per user using Redis Sets.
 * 
 * Keys structure:
 * - user:online:{userId} = "1" (with TTL)
 * - user:sockets:{userId} = Set of socketIds
 */
class UserOnlineService {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    /**
     * Mark user as online and track socket connection.
     * Handles multiple tabs - user stays online if any socket is connected.
     */
    async setUserOnline(userId: number, socketId: string): Promise<void> {
        const redis = this.redisService.getClient();
        const socketsKey = `${REDIS_USER_SOCKETS_PREFIX}${userId}`;
        const onlineKey = `${REDIS_USER_ONLINE_PREFIX}${userId}`;

        try {
            // Add socket to user's socket set
            await redis.sadd(socketsKey, socketId);

            // Set online status with TTL (refreshed on each connection)
            await redis.set(onlineKey, Date.now().toString(), "EX", ONLINE_TTL_SECONDS);

            logger.info(`[UserOnline] User ${userId} connected via socket ${socketId}`);
        } catch (error) {
            logger.error(`[UserOnline] Error setting user ${userId} online:`, error);
        }
    }

    /**
     * Remove socket from user's connections.
     * Only marks user as offline if no sockets remain.
     */
    async setUserOffline(userId: number, socketId: string): Promise<void> {
        const redis = this.redisService.getClient();
        const socketsKey = `${REDIS_USER_SOCKETS_PREFIX}${userId}`;
        const onlineKey = `${REDIS_USER_ONLINE_PREFIX}${userId}`;

        try {
            // Remove this socket from the set
            await redis.srem(socketsKey, socketId);

            // Check remaining sockets count
            const remainingSockets = await redis.scard(socketsKey);

            if (remainingSockets === 0) {
                // No more sockets - user is truly offline
                await redis.del(onlineKey);
                await redis.del(socketsKey); // Cleanup empty set
                logger.info(`[UserOnline] User ${userId} disconnected (no active sockets)`);
            } else {
                logger.debug(`[UserOnline] User ${userId} closed socket ${socketId}, ${remainingSockets} sockets remaining`);
            }
        } catch (error) {
            logger.error(`[UserOnline] Error setting user ${userId} offline:`, error);
        }
    }

    /**
     * Check if a specific user is online.
     */
    async isUserOnline(userId: number): Promise<boolean> {
        const onlineKey = `${REDIS_USER_ONLINE_PREFIX}${userId}`;
        const value = await this.redisService.getValue(onlineKey);
        return value !== null;
    }

    /**
     * Get all online user IDs.
     * Uses SCAN to avoid blocking Redis with KEYS command.
     */
    async getOnlineUsers(): Promise<number[]> {
        const redis = this.redisService.getClient();
        const onlineUsers: number[] = [];
        const pattern = `${REDIS_USER_ONLINE_PREFIX}*`;

        try {
            let cursor = "0";
            do {
                const [newCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
                cursor = newCursor;

                for (const key of keys) {
                    // Extract userId from key "user:online:123"
                    const userIdStr = key.replace(REDIS_USER_ONLINE_PREFIX, "");
                    const userId = parseInt(userIdStr, 10);
                    if (!isNaN(userId)) {
                        onlineUsers.push(userId);
                    }
                }
            } while (cursor !== "0");

            return onlineUsers;
        } catch (error) {
            logger.error("[UserOnline] Error getting online users:", error);
            return [];
        }
    }

    /**
     * Get count of active sockets for a user.
     * Useful for debugging multi-tab scenarios.
     */
    async getUserSocketCount(userId: number): Promise<number> {
        const redis = this.redisService.getClient();
        const socketsKey = `${REDIS_USER_SOCKETS_PREFIX}${userId}`;
        return redis.scard(socketsKey);
    }

    /**
     * Force disconnect a user (admin action).
     * Removes all socket tracking and online status.
     */
    async forceOffline(userId: number): Promise<void> {
        const redis = this.redisService.getClient();
        const socketsKey = `${REDIS_USER_SOCKETS_PREFIX}${userId}`;
        const onlineKey = `${REDIS_USER_ONLINE_PREFIX}${userId}`;

        await redis.del(onlineKey);
        await redis.del(socketsKey);
        logger.info(`[UserOnline] User ${userId} forced offline`);
    }

    /**
     * Refresh online status (heartbeat).
     * Extends the TTL without adding a new socket.
     */
    async refreshUserOnline(userId: number): Promise<void> {
        const onlineKey = `${REDIS_USER_ONLINE_PREFIX}${userId}`;
        const redis = this.redisService.getClient();

        await redis.expire(onlineKey, ONLINE_TTL_SECONDS);
    }
}

// Export singleton instance
export default new UserOnlineService();

// Also export class for testing
export { UserOnlineService };
