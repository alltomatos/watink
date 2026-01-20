import { Router } from "express";
import sequelize from "../database";

const postgresRoutes = Router();

/**
 * @openapi
 * /postgres/version:
 *   get:
 *     summary: Retorna a versão do serviço pgvectorgis (PostgreSQL)
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Versão do PostgreSQL
 */
postgresRoutes.get("/postgres/version", async (req, res) => {
  try {
    const [rows]: any = await sequelize.query("SELECT version()");
    const versionStr: string = rows?.[0]?.version || "unknown";
    const lastUpdated =
      process.env.BUILD_TIMESTAMP ||
      new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      service: "pgvectorgis",
      version: versionStr,
      lastUpdated,
    });
  } catch (e) {
    res.status(502).json({ error: "Database Unavailable" });
  }
});

export default postgresRoutes;

