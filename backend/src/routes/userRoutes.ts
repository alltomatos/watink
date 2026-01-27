import { Router } from "express";

import isAuth from "../middleware/isAuth";
import multer from "multer";
import uploadConfig from "../config/upload";
import * as UserController from "../controllers/UserController";

const userRoutes = Router();
const upload = multer(uploadConfig);

userRoutes.get("/", isAuth, UserController.index);

userRoutes.post("/", isAuth, UserController.store);

userRoutes.put("/:userId", isAuth, upload.single("profileImage"), UserController.update);

userRoutes.get("/:userId", isAuth, UserController.show);

userRoutes.delete("/:userId", isAuth, UserController.remove);

userRoutes.post("/:userId/toggle-status", isAuth, UserController.toggleStatus);

userRoutes.post("/:userId/resend-welcome", isAuth, UserController.resendWelcomeEmail);

userRoutes.post("/:userId/manual-verify", isAuth, UserController.manualVerify);


export default userRoutes;
