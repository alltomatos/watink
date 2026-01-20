import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";

import * as SettingController from "../controllers/SettingController";

const settingRoutes = Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

settingRoutes.get("/settings", isAuth, SettingController.index);
settingRoutes.get("/public-settings", SettingController.getPublicSettings); // [NEW] Public route

// routes.get("/settings/:settingKey", isAuth, SettingsController.show);

// change setting key to key in future
settingRoutes.put("/settings/:settingKey", isAuth, SettingController.update);

// Logo upload route
settingRoutes.post("/settings/logo", isAuth, upload.single("logo"), SettingController.uploadLogo);

// Favicon upload route
settingRoutes.post("/settings/favicon", isAuth, upload.single("favicon"), SettingController.uploadFavicon);

// Login Image upload route
settingRoutes.post("/settings/loginImage", isAuth, upload.single("loginImage"), SettingController.uploadLoginImage);

export default settingRoutes;
