import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as KnowledgeController from "../controllers/KnowledgeController";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const knowledgeRoutes = express.Router();

// ... (Swagger docs omitted)

knowledgeRoutes.get(
    "/knowledge-bases",
    isAuth,
    checkPermission("view_knowledge_bases"),
    KnowledgeController.index
);

knowledgeRoutes.get(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("view_knowledge_bases"),
    KnowledgeController.show
);

knowledgeRoutes.post(
    "/knowledge-bases",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    KnowledgeController.store
);

knowledgeRoutes.put(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    KnowledgeController.update
);

knowledgeRoutes.delete(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    KnowledgeController.remove
);

knowledgeRoutes.get(
    "/knowledge-bases/:knowledgeBaseId/sources",
    isAuth,
    checkPermission("view_knowledge_bases"),
    KnowledgeController.listSources
);

knowledgeRoutes.post(
    "/knowledge-bases/:knowledgeBaseId/sources",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    upload.single("file"),
    KnowledgeController.createSource
);

knowledgeRoutes.delete(
    "/knowledge-bases/sources/:sourceId",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    KnowledgeController.removeSource
);

knowledgeRoutes.post(
    "/knowledge-bases/sources/:sourceId/retry",
    isAuth,
    checkPermission("manage_knowledge_bases"),
    KnowledgeController.retrySource
);

export default knowledgeRoutes;
