import { Router } from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as FlowController from "../controllers/FlowController";

const flowRoutes = Router();

// ... (Swagger docs omitted)

flowRoutes.get(
    "/flows",
    isAuth,
    checkPermission("view_flows"),
    FlowController.index
);

flowRoutes.get(
    "/flows/:flowId",
    isAuth,
    checkPermission("view_flows"),
    FlowController.show
);

flowRoutes.post(
    "/flows",
    isAuth,
    checkPermission("manage_flows"),
    FlowController.store
);

flowRoutes.put(
    "/flows/:flowId",
    isAuth,
    checkPermission("manage_flows"),
    FlowController.update
);

flowRoutes.post(
    "/flows/:flowId/toggle",
    isAuth,
    checkPermission("manage_flows"),
    FlowController.toggle
);

flowRoutes.post(
    "/flows/:flowId/simulate",
    isAuth,
    checkPermission("view_flows"),
    FlowController.simulate
);

flowRoutes.post(
    "/flows/ai",
    isAuth,
    checkPermission("manage_flows"),
    FlowController.generateFlowAI
);

export default flowRoutes;
