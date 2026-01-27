import { Router } from "express";
import isSaasAuth from "../middleware/isSaasAuth";
import * as SaasController from "../controllers/SaasController";

const saasRoutes = Router();

// Protected by JWT (User must provide a valid token signed with the instance's secret)
saasRoutes.get("/saas/stats", isSaasAuth, SaasController.getStats);

export default saasRoutes;
