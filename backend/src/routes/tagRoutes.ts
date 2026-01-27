import { Router } from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";
import * as TagController from "../controllers/TagController";

const tagRoutes = Router();

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Lista todas as tags do tenant
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: includeArchived
 *         in: query
 *         schema:
 *           type: boolean
 *       - name: groupId
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de tags
 */
tagRoutes.get(
    "/tags",
    isAuth,
    checkPermission("tags:read"),
    TagController.index
);

/**
 * @swagger
 * /tags/colors:
 *   get:
 *     summary: Lista paleta de cores disponíveis
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto com cores disponíveis
 */
tagRoutes.get("/tags/colors", isAuth, TagController.colors);

/**
 * @swagger
 * /tags/{tagId}:
 *   get:
 *     summary: Busca uma tag por ID
 *     tags: [Tags]
 */
tagRoutes.get(
    "/tags/:tagId",
    isAuth,
    checkPermission("tags:read"),
    TagController.show
);

/**
 * @swagger
 * /tags:
 *   post:
 *     summary: Cria uma nova tag
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *               description:
 *                 type: string
 *               groupId:
 *                 type: integer
 */
tagRoutes.post(
    "/tags",
    isAuth,
    checkPermission("tags:write"),
    TagController.store
);

/**
 * @swagger
 * /tags/{tagId}:
 *   put:
 *     summary: Atualiza uma tag
 *     tags: [Tags]
 */
tagRoutes.put(
    "/tags/:tagId",
    isAuth,
    checkPermission("tags:write"),
    TagController.update
);

/**
 * @swagger
 * /tags/{tagId}:
 *   delete:
 *     summary: Arquiva ou deleta uma tag
 *     tags: [Tags]
 *     parameters:
 *       - name: forceDelete
 *         in: query
 *         schema:
 *           type: boolean
 */
tagRoutes.delete(
    "/tags/:tagId",
    isAuth,
    checkPermission("tags:write"),
    TagController.remove
);

// === TAG GROUPS ===

/**
 * @swagger
 * /tag-groups:
 *   get:
 *     summary: Lista grupos de tags
 *     tags: [Tags]
 */
tagRoutes.get(
    "/tag-groups",
    isAuth,
    checkPermission("tags:read"),
    TagController.indexGroups
);

/**
 * @swagger
 * /tag-groups:
 *   post:
 *     summary: Cria um grupo de tags
 *     tags: [Tags]
 */
tagRoutes.post(
    "/tag-groups",
    isAuth,
    checkPermission("tags:write"),
    TagController.storeGroup
);

/**
 * @swagger
 * /tag-groups/{groupId}:
 *   put:
 *     summary: Atualiza um grupo de tags
 *     tags: [Tags]
 */
tagRoutes.put(
    "/tag-groups/:groupId",
    isAuth,
    checkPermission("tags:write"),
    TagController.updateGroup
);

/**
 * @swagger
 * /tag-groups/{groupId}:
 *   delete:
 *     summary: Deleta um grupo de tags
 *     tags: [Tags]
 */
tagRoutes.delete(
    "/tag-groups/:groupId",
    isAuth,
    checkPermission("tags:write"),
    TagController.removeGroup
);

// === ENTITY TAGS ===

/**
 * @swagger
 * /entities/{entityType}/{entityId}/tags:
 *   get:
 *     summary: Lista tags de uma entidade
 *     tags: [Tags]
 *     parameters:
 *       - name: entityType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [contact, ticket, deal]
 *       - name: entityId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */
tagRoutes.get(
    "/entities/:entityType/:entityId/tags",
    isAuth,
    checkPermission("tags:read"),
    TagController.listEntityTags
);

/**
 * @swagger
 * /entities/{entityType}/{entityId}/tags:
 *   post:
 *     summary: Aplica uma tag a uma entidade
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tagId
 *             properties:
 *               tagId:
 *                 type: integer
 */
tagRoutes.post(
    "/entities/:entityType/:entityId/tags",
    isAuth,
    checkPermission("tags:apply"),
    TagController.applyTag
);

/**
 * @swagger
 * /entities/{entityType}/{entityId}/tags/sync:
 *   put:
 *     summary: Sincroniza tags de uma entidade (substitui todas)
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tagIds
 *             properties:
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 */
tagRoutes.put(
    "/entities/:entityType/:entityId/tags/sync",
    isAuth,
    checkPermission("tags:apply"),
    TagController.syncTags
);

/**
 * @swagger
 * /entities/{entityType}/{entityId}/tags/{tagId}:
 *   delete:
 *     summary: Remove uma tag de uma entidade
 *     tags: [Tags]
 */
tagRoutes.delete(
    "/entities/:entityType/:entityId/tags/:tagId",
    isAuth,
    checkPermission("tags:apply"),
    TagController.removeTag
);

export default tagRoutes;
