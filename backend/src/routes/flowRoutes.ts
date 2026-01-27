import { Router } from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as FlowController from "../controllers/FlowController";

const flowRoutes = Router();

// ... (Swagger docs omitted)

flowRoutes.get(
    "/flows",
    isAuth,
    checkPermission("flows:read"),
    FlowController.index
);

flowRoutes.get(
    "/flows/:flowId",
    isAuth,
    checkPermission("flows:read"),
    FlowController.show
);

flowRoutes.post(
    "/flows",
    isAuth,
    checkPermission("flows:write"),
    FlowController.store
);

flowRoutes.put(
    "/flows/:flowId",
    isAuth,
    checkPermission("flows:write"),
    FlowController.update
);

flowRoutes.post(
    "/flows/:flowId/toggle",
    isAuth,
    checkPermission("flows:write"),
    FlowController.toggle
);

flowRoutes.post(
    "/flows/:flowId/simulate",
    isAuth,
    checkPermission("flows:read"),
    FlowController.simulate
);

flowRoutes.post(
    "/flows/ai",
    isAuth,
    checkPermission("flows:write"),
    FlowController.generateFlowAI
);

export default flowRoutes;
