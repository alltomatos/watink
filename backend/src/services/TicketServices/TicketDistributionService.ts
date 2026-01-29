import { Op, QueryTypes } from "sequelize";
import Ticket from "../../models/Ticket";
import Queue, { DISTRIBUTION_STRATEGIES, DistributionStrategy } from "../../models/Queue";
import User from "../../models/User";
import Contact from "../../models/Contact";
import UserQueue from "../../models/UserQueue";
import { RedisService } from "../RedisService";
import UserOnlineService from "../UserServices/UserOnlineService";
import { logger } from "../../utils/logger";
import sequelize from "../../database";

// Constants for Redis keys
const REDIS_ROUND_ROBIN_PREFIX = "queue:rr:";
const DISTRIBUTION_LOCK_PREFIX = "distribution:lock:queue:";
const LOCK_TTL_SECONDS = 5;
const LOCK_RETRY_DELAY_MS = 100;
const LOCK_MAX_RETRIES = 3;

interface DistributionResult {
    user: User | null;
    strategy: DistributionStrategy;
    reason: string;
}

/**
 * TicketDistributionService
 * 
 * Centralized service for distributing tickets to users based on queue configuration.
 * Implements multiple distribution strategies:
 * - MANUAL: No automatic distribution (userId remains null)
 * - AUTO_ROUND_ROBIN: Circular distribution among online users
 * - AUTO_BALANCED: Distribution based on workload (least connections)
 * 
 * Also supports Sticky Routing (wallet prioritization) when enabled.
 */
class TicketDistributionService {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    /**
     * Main entry point for ticket distribution.
     * Applies the distribution strategy configured for the queue.
     */
    async distributeTicket(ticket: Ticket, queue: Queue): Promise<DistributionResult> {
        const strategy = queue.distributionStrategy as DistributionStrategy;

        // MANUAL strategy: no automatic distribution
        if (strategy === DISTRIBUTION_STRATEGIES.MANUAL) {
            return {
                user: null,
                strategy,
                reason: "Manual distribution - ticket awaiting pickup"
            };
        }

        // Try to acquire lock to prevent race conditions
        const lockAcquired = await this.acquireLock(queue.id);
        if (!lockAcquired) {
            logger.warn(`[Distribution] Failed to acquire lock for queue ${queue.id}, proceeding without lock`);
        }

        try {
            // Step 1: Sticky Routing (Wallet Priority)
            if (queue.prioritizeWallet) {
                const walletResult = await this.stickyRouting(ticket, queue);
                if (walletResult.user) {
                    return walletResult;
                }
                // Fallback to general distribution if wallet user is unavailable
                logger.info(`[Distribution] Wallet user unavailable for ticket ${ticket.id}, falling back to ${strategy}`);
            }

            // Step 2: Apply general distribution strategy
            switch (strategy) {
                case DISTRIBUTION_STRATEGIES.AUTO_BALANCED:
                    return await this.autoBalanced(queue);

                case DISTRIBUTION_STRATEGIES.AUTO_ROUND_ROBIN:
                    return await this.autoRoundRobin(queue);

                default:
                    return {
                        user: null,
                        strategy,
                        reason: `Unknown strategy: ${strategy}`
                    };
            }
        } finally {
            // Release lock
            if (lockAcquired) {
                await this.releaseLock(queue.id);
            }
        }
    }

    /**
     * Sticky Routing: Prioritize the wallet owner if online.
     */
    private async stickyRouting(ticket: Ticket, queue: Queue): Promise<DistributionResult> {
        // Load contact with wallet user info
        const contact = await Contact.findByPk(ticket.contactId, {
            attributes: ["id", "walletUserId"]
        });

        if (!contact?.walletUserId) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.MANUAL,
                reason: "Contact has no wallet owner"
            };
        }

        // Check if wallet user is in this queue
        const isUserInQueue = await UserQueue.findOne({
            where: {
                userId: contact.walletUserId,
                queueId: queue.id
            }
        });

        if (!isUserInQueue) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.MANUAL,
                reason: "Wallet owner not in this queue"
            };
        }

        // Check if wallet user is online
        const isOnline = await UserOnlineService.isUserOnline(contact.walletUserId);
        if (!isOnline) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.MANUAL,
                reason: "Wallet owner is offline"
            };
        }

        // Check if user is not an auditor
        const user = await User.findByPk(contact.walletUserId, {
            attributes: ["id", "name"],
            include: [{
                model: require("../../models/Role").default,
                as: "roles",
                where: { name: "Auditor" },
                required: false
            }]
        });

        if (!user || (user as any).roles?.length > 0) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.MANUAL,
                reason: "Wallet owner is auditor or not found"
            };
        }

        // Update user's lastAssignmentAt
        await user.update({ lastAssignmentAt: new Date() });

        return {
            user,
            strategy: DISTRIBUTION_STRATEGIES.MANUAL, // Sticky routing is a special case
            reason: `Assigned to wallet owner: ${user.name}`
        };
    }

    /**
     * AUTO_BALANCED: Distribute to the user with the least active tickets.
     * Uses a single optimized SQL query for performance.
     */
    private async autoBalanced(queue: Queue): Promise<DistributionResult> {
        // Get online users from Redis
        const onlineUserIds = await this.getOnlineUsersInQueue(queue.id);

        if (onlineUserIds.length === 0) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.AUTO_BALANCED,
                reason: "No online users available in queue"
            };
        }

        // Optimized query: Get user with least tickets, excluding auditors
        const results = await sequelize.query<{
            id: number;
            name: string;
            lastAssignmentAt: Date | null;
            ticket_count: number;
        }>(
            `SELECT u.id, u.name, u."lastAssignmentAt",
              COALESCE(COUNT(t.id), 0)::integer as ticket_count
       FROM "Users" u
       INNER JOIN "UserQueues" uq ON u.id = uq."userId"
       LEFT JOIN "Tickets" t ON t."userId" = u.id 
         AND t.status IN ('open', 'pending')
       WHERE uq."queueId" = :queueId
         AND u.id IN (:userIds)
         AND u.profile != 'auditor'
       GROUP BY u.id, u.name, u."lastAssignmentAt"
       ORDER BY ticket_count ASC, u."lastAssignmentAt" ASC NULLS FIRST
       LIMIT 1`,
            {
                replacements: {
                    queueId: queue.id,
                    userIds: onlineUserIds
                },
                type: QueryTypes.SELECT
            }
        );

        if (results.length === 0) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.AUTO_BALANCED,
                reason: "No eligible users found (all auditors or empty)"
            };
        }

        const userData = results[0];
        const user = await User.findByPk(userData.id);

        if (!user) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.AUTO_BALANCED,
                reason: "User not found after query"
            };
        }

        // Update lastAssignmentAt
        await user.update({ lastAssignmentAt: new Date() });

        return {
            user,
            strategy: DISTRIBUTION_STRATEGIES.AUTO_BALANCED,
            reason: `Balanced distribution: ${user.name} (${userData.ticket_count} active tickets)`
        };
    }

    /**
     * AUTO_ROUND_ROBIN: Circular distribution using Redis pointer.
     */
    private async autoRoundRobin(queue: Queue): Promise<DistributionResult> {
        // Get online users from Redis
        const onlineUserIds = await this.getOnlineUsersInQueue(queue.id);

        if (onlineUserIds.length === 0) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.AUTO_ROUND_ROBIN,
                reason: "No online users available in queue"
            };
        }

        // Filter out auditors (those with 'Auditor' role)
        const eligibleUsers = await User.findAll({
            where: {
                id: { [Op.in]: onlineUserIds }
            },
            include: [{
                model: require("../../models/Role").default,
                as: "roles",
                where: { name: "Auditor" },
                required: false
            }],
            attributes: ["id", "name"],
            order: [["id", "ASC"]]
        }).then(users => users.filter(u => !(u as any).roles || (u as any).roles.length === 0));

        if (eligibleUsers.length === 0) {
            return {
                user: null,
                strategy: DISTRIBUTION_STRATEGIES.AUTO_ROUND_ROBIN,
                reason: "No eligible users found (all auditors)"
            };
        }

        // Get current round-robin index from Redis
        const rrKey = `${REDIS_ROUND_ROBIN_PREFIX}${queue.id}`;
        let currentIndex = parseInt((await this.redisService.getValue(rrKey)) || "0", 10);

        // Ensure index is valid
        if (currentIndex >= eligibleUsers.length || isNaN(currentIndex)) {
            currentIndex = 0;
        }

        const selectedUser = eligibleUsers[currentIndex];

        // Increment and store next index
        const nextIndex = (currentIndex + 1) % eligibleUsers.length;
        await this.redisService.setValue(rrKey, nextIndex.toString());

        // Update lastAssignmentAt
        await selectedUser.update({ lastAssignmentAt: new Date() });

        return {
            user: selectedUser,
            strategy: DISTRIBUTION_STRATEGIES.AUTO_ROUND_ROBIN,
            reason: `Round-robin distribution: ${selectedUser.name} (position ${currentIndex + 1}/${eligibleUsers.length})`
        };
    }

    /**
     * Get list of online user IDs in a specific queue.
     */
    private async getOnlineUsersInQueue(queueId: number): Promise<number[]> {
        // Get all users in queue
        const usersInQueue = await UserQueue.findAll({
            where: { queueId },
            attributes: ["userId"]
        });

        const userIds = usersInQueue.map(uq => uq.userId);
        const onlineUserIds: number[] = [];

        // Check each user's online status
        for (const userId of userIds) {
            if (await UserOnlineService.isUserOnline(userId)) {
                onlineUserIds.push(userId);
            }
        }

        return onlineUserIds;
    }

    /**
     * Acquire a distributed lock for queue distribution.
     */
    private async acquireLock(queueId: number, retries: number = LOCK_MAX_RETRIES): Promise<boolean> {
        const lockKey = `${DISTRIBUTION_LOCK_PREFIX}${queueId}`;
        const lockValue = `${Date.now()}-${Math.random()}`;

        for (let i = 0; i < retries; i++) {
            const acquired = await this.redisService.setNx(lockKey, lockValue, LOCK_TTL_SECONDS);
            if (acquired) {
                return true;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
        }

        return false;
    }

    /**
     * Release distribution lock.
     */
    private async releaseLock(queueId: number): Promise<void> {
        const lockKey = `${DISTRIBUTION_LOCK_PREFIX}${queueId}`;
        await this.redisService.delValue(lockKey);
    }
}

// Export singleton instance
export default new TicketDistributionService();

// Also export class for testing
export { TicketDistributionService };
