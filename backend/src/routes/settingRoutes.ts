import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as SettingController from "../controllers/SettingController";

const settingRoutes = Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

settingRoutes.get("/settings", isAuth, checkPermission("settings:read"), SettingController.index);
settingRoutes.get("/public-settings", SettingController.getPublicSettings); // [NEW] Public route

// routes.get("/settings/:settingKey", isAuth, SettingsController.show);

// change setting key to key in future
settingRoutes.put("/settings/:settingKey", isAuth, checkPermission("settings:edit"), SettingController.update);

// Logo upload route
settingRoutes.post("/settings/logo", isAuth, checkPermission("settings:edit"), upload.single("logo"), SettingController.uploadLogo);

// Favicon upload route
settingRoutes.post("/settings/favicon", isAuth, checkPermission("settings:edit"), upload.single("favicon"), SettingController.uploadFavicon);

// Login Image upload route
settingRoutes.post("/settings/loginImage", isAuth, checkPermission("settings:edit"), upload.single("loginImage"), SettingController.uploadLoginImage);

// Mobile Logo upload route
settingRoutes.post("/settings/mobileLogo", isAuth, checkPermission("settings:edit"), upload.single("mobileLogo"), SettingController.uploadMobileLogo);

export default settingRoutes;
