import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as ClientController from "../controllers/ClientController";

const clientRoutes = express.Router();

clientRoutes.get("/clients", isAuth, checkPermission("view_clients"), ClientController.index);
clientRoutes.post("/clients", isAuth, checkPermission("edit_clients"), ClientController.store);
clientRoutes.get("/clients/:clientId", isAuth, checkPermission("view_clients"), ClientController.show);
clientRoutes.put("/clients/:clientId", isAuth, checkPermission("edit_clients"), ClientController.update);
clientRoutes.delete("/clients/:clientId", isAuth, checkPermission("delete_clients"), ClientController.remove);

export default clientRoutes;
