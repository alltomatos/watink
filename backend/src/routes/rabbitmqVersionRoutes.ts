import { Router } from "express";
import axios from "axios";

const rabbitRoutes = Router();

/**
 * @openapi
 * /rabbitmq/version:
 *   get:
 *     summary: Retorna a versão do serviço RabbitMQ
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Versão do RabbitMQ
 */
rabbitRoutes.get("/rabbitmq/version", async (req, res) => {
  try {
    const amqp = process.env.AMQP_URL || "amqp://guest:guest@rabbitmq:5672";
    const m = amqp.match(/amqp:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?/);
    const user = m?.[1] || "guest";
    const pass = m?.[2] || "guest";
    const host = m?.[3] || "rabbitmq";

    // Allow overriding management URL entirely, or fallback to auto-detection
    const mgmt = process.env.RABBITMQ_MGMT_URL || `http://${host}:15672/api/overview`;

    const { data } = await axios.get(mgmt, {
      auth: { username: user, password: pass },
      headers: { "Cache-Control": "no-store" },
      timeout: 1500,
    });
    const versionStr = data?.rabbitmq_version || "unknown";
    const lastUpdated =
      process.env.BUILD_TIMESTAMP ||
      new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      service: "rabbitmq",
      version: versionStr,
      lastUpdated,
    });
  } catch (e) {
    res.status(502).json({ error: "RabbitMQ Unavailable" });
  }
});

export default rabbitRoutes;

