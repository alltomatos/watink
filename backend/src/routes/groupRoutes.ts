import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as GroupController from "../controllers/GroupController";

const groupRoutes = Router();

groupRoutes.post("/groups", isAuth, GroupController.store);
groupRoutes.get("/groups", isAuth, GroupController.index);
groupRoutes.get("/groups/:groupId", isAuth, GroupController.show);
groupRoutes.put("/groups/:groupId", isAuth, GroupController.update);
groupRoutes.delete("/groups/:groupId", isAuth, GroupController.remove);
groupRoutes.get("/permissions", isAuth, GroupController.listPermissions);

export default groupRoutes;
