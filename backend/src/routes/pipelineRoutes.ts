import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as PipelineController from "../controllers/PipelineController";

const pipelineRoutes = Router();

/**
 * @swagger
 * tags:
 *   name: Pipelines
 *   description: Gerenciamento de Pipelines CRM (Kanban)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Pipeline:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único do pipeline
 *         name:
 *           type: string
 *           description: Nome do pipeline
 *         stages:
 *           type: array
 *           description: Etapas do pipeline
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               name:
 *                 type: string
 *               order:
 *                 type: integer
 *               color:
 *                 type: string
 *         tenantId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /pipelines:
 *   get:
 *     summary: Lista todos os pipelines
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pipelines
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pipeline'
 */
pipelineRoutes.get("/pipelines", isAuth, PipelineController.index);

/**
 * @swagger
 * /pipelines:
 *   post:
 *     summary: Cria um novo pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
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
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     order:
 *                       type: integer
 *                     color:
 *                       type: string
 *     responses:
 *       200:
 *         description: Pipeline criado com sucesso
 */
pipelineRoutes.post("/pipelines", isAuth, PipelineController.store);

/**
 * @swagger
 * /pipelines/{pipelineId}:
 *   put:
 *     summary: Atualiza um pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pipelineId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               stages:
 *                 type: array
 *     responses:
 *       200:
 *         description: Pipeline atualizado com sucesso
 */
pipelineRoutes.put("/pipelines/:pipelineId", isAuth, PipelineController.update);

/**
 * @swagger
 * /pipelines/{pipelineId}:
 *   delete:
 *     summary: Remove um pipeline
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pipelineId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pipeline removido com sucesso
 */
pipelineRoutes.delete("/pipelines/:pipelineId", isAuth, PipelineController.remove);

/**
 * @swagger
 * /pipelines/ai-suggest:
 *   post:
 *     summary: Sugere etapas de pipeline usando IA
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Descrição do negócio para sugestão de etapas
 *     responses:
 *       200:
 *         description: Sugestões de etapas geradas pela IA
 */
pipelineRoutes.post("/pipelines/ai-suggest", isAuth, PipelineController.aiSuggest);

/**
 * @swagger
 * /pipelines/export/{pipelineId}:
 *   get:
 *     summary: Exporta um pipeline em formato JSON
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pipelineId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pipeline exportado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pipeline'
 */
pipelineRoutes.get("/pipelines/export/:pipelineId", isAuth, PipelineController.exportPipeline);

/**
 * @swagger
 * /pipelines/import:
 *   post:
 *     summary: Importa um pipeline de JSON
 *     tags: [Pipelines]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Pipeline'
 *     responses:
 *       200:
 *         description: Pipeline importado com sucesso
 */
pipelineRoutes.post("/pipelines/import", isAuth, PipelineController.importPipeline);

export default pipelineRoutes;
