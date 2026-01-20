import { Router } from "express";
import { RedisService } from "../services/RedisService";

const redisRoutes = Router();

/**
 * @openapi
 * /redis/version:
 *   get:
 *     summary: Retorna a versão e status do serviço Redis
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Status do Redis
 */
redisRoutes.get("/redis/version", async (req, res) => {
    try {
        const redis = RedisService.getInstance();
        const info = await redis.info();

        // Parse Redis Version from INFO output (redis_version:6.2.6)
        const versionMatch = info.match(/redis_version:([^\r\n]+)/);
        const versionStr = versionMatch ? versionMatch[1] : "unknown";

        const lastUpdated =
            process.env.BUILD_TIMESTAMP ||
            new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();

        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({
            service: "redis",
            version: versionStr,
            status: "connected",
            lastUpdated,
        });
    } catch (e) {
        res.setHeader("Cache-Control", "no-store");
        // Return 200 with error status handling to allow dashboard to show "Error" column instead of crashing
        // But VersionDashboard expects 200 for success. If we error, it shows error in column.
        // Dashboard code throws on !res.ok.
        res.status(503).json({
            service: "redis",
            version: "unknown",
            status: "disconnected",
            error: "Redis Unavailable"
        });
    }
});

export default redisRoutes;
