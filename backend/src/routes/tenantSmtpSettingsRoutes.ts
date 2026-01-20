import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as TenantSmtpSettingsController from "../controllers/TenantSmtpSettingsController";

const tenantSmtpSettingsRoutes = Router();

tenantSmtpSettingsRoutes.get("/smtp", isAuth, TenantSmtpSettingsController.show);
tenantSmtpSettingsRoutes.put("/smtp", isAuth, TenantSmtpSettingsController.update);
tenantSmtpSettingsRoutes.post("/smtp/test", isAuth, TenantSmtpSettingsController.test);

export default tenantSmtpSettingsRoutes;
