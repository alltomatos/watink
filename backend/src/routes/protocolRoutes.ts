import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import uploadConfig from "../config/upload";
import * as ProtocolController from "../controllers/ProtocolController";
import * as ProtocolPublicController from "../controllers/ProtocolPublicController";
import * as ProtocolKanbanController from "../controllers/ProtocolKanbanController";
import * as ProtocolAttachmentController from "../controllers/ProtocolAttachmentController";

const protocolRoutes = express.Router();
const upload = multer(uploadConfig);

protocolRoutes.get("/protocols/kanban", isAuth, checkPermission("helpdesk:read"), ProtocolKanbanController.index);
protocolRoutes.get("/protocols/dashboard", isAuth, checkPermission("helpdesk:read"), ProtocolController.dashboard);
protocolRoutes.get("/protocols", isAuth, checkPermission("helpdesk:read"), ProtocolController.index);
protocolRoutes.post("/protocols", isAuth, checkPermission("helpdesk:write"), ProtocolController.store);
protocolRoutes.get("/protocols/:protocolId", isAuth, checkPermission("helpdesk:read"), ProtocolController.show);
protocolRoutes.put("/protocols/:protocolId", isAuth, upload.array("files", 10), checkPermission("helpdesk:write"), ProtocolController.update);

// Attachment routes
protocolRoutes.get("/protocols/:protocolId/attachments", isAuth, checkPermission("helpdesk:read"), ProtocolAttachmentController.index);
protocolRoutes.post("/protocols/:protocolId/attachments", isAuth, upload.array("files", 10), checkPermission("helpdesk:write"), ProtocolAttachmentController.store);
protocolRoutes.delete("/protocols/:protocolId/attachments/:attachmentId", isAuth, checkPermission("helpdesk:write"), ProtocolAttachmentController.destroy);

// Public route for protocol checking
protocolRoutes.get("/public/protocols/:token", ProtocolPublicController.show);
protocolRoutes.get("/public/protocols/:token/attachments", ProtocolAttachmentController.publicIndex);

// Special route for creating protocol from contact drawer
protocolRoutes.post("/contacts/:contactId/protocols", isAuth, ProtocolController.createFromContact);

export default protocolRoutes;

