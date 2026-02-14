import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as UserController from "../controllers/UserController";

const userRoutes = Router();

userRoutes.get("/", isAuth, UserController.index);

userRoutes.post("/", isAuth, UserController.store);

userRoutes.put("/:userId", isAuth, UserController.update);

userRoutes.get("/:userId", isAuth, UserController.show);

userRoutes.delete("/:userId", isAuth, UserController.remove);

export default userRoutes;
