import express from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

import * as QuickAnswerController from "../controllers/QuickAnswerController";

const quickAnswerRoutes = express.Router();

quickAnswerRoutes.get(
  "/quickAnswers",
  isAuth,
  checkPermission("view_quick_answers"),
  QuickAnswerController.index
);

quickAnswerRoutes.get(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("view_quick_answers"),
  QuickAnswerController.show
);

quickAnswerRoutes.post(
  "/quickAnswers",
  isAuth,
  checkPermission("manage_quick_answers"),
  QuickAnswerController.store
);

quickAnswerRoutes.put(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("manage_quick_answers"),
  QuickAnswerController.update
);

quickAnswerRoutes.delete(
  "/quickAnswers/:quickAnswerId",
  isAuth,
  checkPermission("manage_quick_answers"),
  QuickAnswerController.remove
);

export default quickAnswerRoutes;
