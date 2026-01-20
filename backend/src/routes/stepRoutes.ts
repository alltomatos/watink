import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as StepController from "../controllers/StepController";

const stepRoutes = Router();

// List all steps (optionally filtered by queueId query param)
stepRoutes.get("/steps", isAuth, StepController.index);

// Create a new step
stepRoutes.post("/steps", isAuth, StepController.store);

// Reorder steps within a queue
stepRoutes.put("/steps/reorder", isAuth, StepController.reorder);

// Get a specific step
stepRoutes.get("/steps/:stepId", isAuth, StepController.show);

// Update a step
stepRoutes.put("/steps/:stepId", isAuth, StepController.update);

// Delete a step
stepRoutes.delete("/steps/:stepId", isAuth, StepController.remove);

export default stepRoutes;
