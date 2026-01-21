import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as EmailTemplateController from "../controllers/EmailTemplateController";

const emailTemplateRoutes = Router();

emailTemplateRoutes.get("/email-templates", isAuth, EmailTemplateController.index);
emailTemplateRoutes.get("/email-templates/:templateId", isAuth, EmailTemplateController.show);
emailTemplateRoutes.post("/email-templates", isAuth, EmailTemplateController.store);
emailTemplateRoutes.put("/email-templates/:templateId", isAuth, EmailTemplateController.update);
emailTemplateRoutes.delete("/email-templates/:templateId", isAuth, EmailTemplateController.remove);

export default emailTemplateRoutes;
