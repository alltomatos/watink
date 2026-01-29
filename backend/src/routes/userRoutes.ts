import { Router } from "express";

import isAuth from "../middleware/isAuth";
import multer from "multer";
import uploadConfig from "../config/upload";
import * as UserController from "../controllers/UserController";

const userRoutes = Router();
const upload = multer(uploadConfig);

import checkPermission from "../middleware/checkPermission";

userRoutes.get("/", isAuth, checkPermission("users:read"), UserController.index);

userRoutes.post("/", isAuth, checkPermission("users:write"), UserController.store);

userRoutes.put("/:userId", isAuth, checkPermission("users:write"), upload.single("profileImage"), UserController.update);

userRoutes.get("/:userId", isAuth, checkPermission("users:read"), UserController.show);

userRoutes.delete("/:userId", isAuth, checkPermission("users:delete"), UserController.remove);

userRoutes.post("/:userId/toggle-status", isAuth, checkPermission("users:write"), UserController.toggleStatus);

userRoutes.post("/:userId/resend-welcome", isAuth, checkPermission("users:write"), UserController.resendWelcomeEmail);

userRoutes.post("/:userId/manual-verify", isAuth, checkPermission("users:write"), UserController.manualVerify);


export default userRoutes;
