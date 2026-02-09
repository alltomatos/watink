import express from "express";
import isAuth from "../middleware/isAuth";
import * as TenantController from "../controllers/TenantController";

const tenantRoutes = express.Router();

tenantRoutes.get("/tenants", isAuth, TenantController.index);

// tenantRoutes.post("/tenants", isAuth, TenantController.store);

tenantRoutes.get("/tenants/:tenantId", isAuth, TenantController.show);

// tenantRoutes.put("/tenants/:tenantId", isAuth, TenantController.update);

// tenantRoutes.delete("/tenants/:tenantId", isAuth, TenantController.remove);

export default tenantRoutes;
