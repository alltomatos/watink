import express from "express";
import isAuth from "../middleware/isAuth";

import * as DealController from "../controllers/DealController";

const dealRoutes = express.Router();

dealRoutes.post("/deals", isAuth, DealController.store);
dealRoutes.get("/deals", isAuth, DealController.index);
dealRoutes.put("/deals/:dealId", isAuth, DealController.update);
dealRoutes.delete("/deals/:dealId", isAuth, DealController.remove);

export default dealRoutes;
