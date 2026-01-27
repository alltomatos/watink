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
    checkPermission("knowledge_bases:read"),
    KnowledgeController.index
);

knowledgeRoutes.get(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("knowledge_bases:read"),
    KnowledgeController.show
);

knowledgeRoutes.post(
    "/knowledge-bases",
    isAuth,
    checkPermission("knowledge_bases:write"),
    KnowledgeController.store
);

knowledgeRoutes.put(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("knowledge_bases:write"),
    KnowledgeController.update
);

knowledgeRoutes.delete(
    "/knowledge-bases/:knowledgeBaseId",
    isAuth,
    checkPermission("knowledge_bases:write"),
    KnowledgeController.remove
);

knowledgeRoutes.get(
    "/knowledge-bases/:knowledgeBaseId/sources",
    isAuth,
    checkPermission("knowledge_bases:read"),
    KnowledgeController.listSources
);

knowledgeRoutes.post(
    "/knowledge-bases/:knowledgeBaseId/sources",
    isAuth,
    checkPermission("knowledge_bases:write"),
    upload.single("file"),
    KnowledgeController.createSource
);

knowledgeRoutes.delete(
    "/knowledge-bases/sources/:sourceId",
    isAuth,
    checkPermission("knowledge_bases:write"),
    KnowledgeController.removeSource
);

knowledgeRoutes.post(
    "/knowledge-bases/sources/:sourceId/retry",
    isAuth,
    checkPermission("knowledge_bases:write"),
    KnowledgeController.retrySource
);

export default knowledgeRoutes;
