import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

import * as QuickAnswerController from "../controllers/QuickAnswerController";

const quickAnswerRoutes = express.Router();

quickAnswerRoutes.get(
  "/quickAnswers",
  isAuth,
  checkPermission("quick_answers:read"),
  QuickAnswerController.index
);

quickAnswerRoutes.get(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("quick_answers:read"),
  QuickAnswerController.show
);

quickAnswerRoutes.post(
  "/quickAnswers",
  isAuth,
  checkPermission("quick_answers:write"),
  QuickAnswerController.store
);

quickAnswerRoutes.put(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("quick_answers:write"),
  QuickAnswerController.update
);

quickAnswerRoutes.delete(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("quick_answers:write"),
  QuickAnswerController.remove
);

export default quickAnswerRoutes;
