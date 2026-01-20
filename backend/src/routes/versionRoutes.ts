import { Router } from "express";
import fs from "fs";
import path from "path";

const versionRoutes = Router();

/**
 * @openapi
 * /version:
 *   get:
 *     summary: Retorna a versão atual do serviço Backend
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Versão atual do serviço e timestamp de build
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: backend
 *                 version:
 *                   type: string
 *                   example: 1.3.121
 *                 lastUpdated:
 *                   type: string
 *                   example: 2026-01-03T14:00:00.000Z
 */
versionRoutes.get("/", (req, res) => {
  let version = "0.0.0";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      version = pkg.version;
    }
  } catch (e) {}

  const lastUpdated =
    process.env.BUILD_TIMESTAMP ||
    new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    service: "backend",
    version,
    lastUpdated,
  });
});

export default versionRoutes;
