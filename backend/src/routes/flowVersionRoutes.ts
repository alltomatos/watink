import { Router } from "express";
import axios from "axios";

const flowRoutes = Router();

/**
 * @openapi
 * /flow/version:
 *   get:
 *     summary: Retorna a versão do serviço Flow Worker
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Versão do Flow Worker
 */
flowRoutes.get("/flow/version", async (req, res) => {
  try {
    const flowEngineUrl = process.env.FLOW_ENGINE_URL || "http://flow-engine-worker:3336";
    const { data } = await axios.get(`${flowEngineUrl}/version`, {
      headers: { "Cache-Control": "no-store" },
      timeout: 1500,
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "Flow Worker Unavailable" });
  }
});

export default flowRoutes;
