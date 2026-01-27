import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as ClientController from "../controllers/ClientController";

const clientRoutes = express.Router();

clientRoutes.get("/clients", isAuth, checkPermission("clients:read"), ClientController.index);
clientRoutes.post("/clients", isAuth, checkPermission("clients:write"), ClientController.store);
clientRoutes.get("/clients/:clientId", isAuth, checkPermission("clients:read"), ClientController.show);
clientRoutes.put("/clients/:clientId", isAuth, checkPermission("clients:write"), ClientController.update);
clientRoutes.delete("/clients/:clientId", isAuth, checkPermission("clients:delete"), ClientController.remove);

export default clientRoutes;
