import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as RoleController from "../controllers/RoleController";

const routes = Router();

routes.get("/permissions", isAuth, RoleController.listPermissions);
routes.get("/roles", isAuth, RoleController.index);
routes.get("/roles/:roleId", isAuth, RoleController.show);
routes.put("/roles/:roleId", isAuth, RoleController.update);

export default routes;
