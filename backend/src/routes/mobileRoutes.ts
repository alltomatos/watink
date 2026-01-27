import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as MobileTicketController from "../controllers/Mobile/MobileTicketController";
import * as MobileAuthController from "../controllers/Mobile/MobileAuthController";
import * as MobileBrandingController from "../controllers/Mobile/MobileBrandingController";

const mobileRoutes = Router();

mobileRoutes.get("/branding", MobileBrandingController.getBranding);
mobileRoutes.use(isAuth);

mobileRoutes.get("/tickets", MobileTicketController.index);
mobileRoutes.post("/device-token", MobileAuthController.saveDeviceToken);

export default mobileRoutes;
