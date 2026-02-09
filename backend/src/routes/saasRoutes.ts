import { Router } from "express";
import isSaasAuth from "../middleware/isSaasAuth";
import isAuth from "../middleware/isAuth";
import * as SaasController from "../controllers/SaasController";
import * as SaasProxyController from "../controllers/SaasProxyController";

const saasRoutes = Router();

// Protected by JWT (User must provide a valid token signed with the instance's secret)
saasRoutes.get("/saas/stats", isSaasAuth, SaasController.getStats);

// SaaS Admin Proxy Routes (Protected by standard Auth)
// TODO: Add a specific middleware for SuperAdmin if needed (e.g. check req.user.profile === 'admin')
saasRoutes.post("/saas/tenants", isAuth, SaasProxyController.store);
saasRoutes.get("/saas/usage", isAuth, SaasProxyController.indexUsage);

export default saasRoutes;
