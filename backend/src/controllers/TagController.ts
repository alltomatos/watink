import { Request, Response } from "express";
import ListTagsService from "../services/TagServices/ListTagsService";
import ShowTagService from "../services/TagServices/ShowTagService";
import CreateTagService from "../services/TagServices/CreateTagService";
import UpdateTagService from "../services/TagServices/UpdateTagService";
import DeleteTagService from "../services/TagServices/DeleteTagService";
import TagGroupService from "../services/TagServices/TagGroupService";
import EntityTagService from "../services/TagServices/EntityTagService";
import { EntityType } from "../models/EntityTag";
import { TAG_COLORS } from "../models/Tag";

/**
 * @swagger
 * components:
 *   schemas:
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         color:
 *           type: string
 *         icon:
 *           type: string
 *         description:
 *           type: string
 *         archived:
 *           type: boolean
 *         usageCount:
 *           type: integer
 */

// === TAGS ===

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { includeArchived, groupId } = req.query;

    const tags = await ListTagsService({
        tenantId,
        includeArchived: includeArchived === "true",
        groupId: groupId ? Number(groupId) : undefined
    });

    return res.json(tags);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { tagId } = req.params;

    const tag = await ShowTagService({
        id: Number(tagId),
        tenantId
    });

    return res.json(tag);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId, id: userId } = req.user;
    const { name, color, icon, description, groupId } = req.body;

    const tag = await CreateTagService({
        tenantId,
        name,
        color,
        icon,
        description,
        groupId,
        createdBy: Number(userId)
    });

    return res.status(201).json(tag);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { tagId } = req.params;
    const { name, color, icon, description, groupId, archived } = req.body;

    const tag = await UpdateTagService({
        id: Number(tagId),
        tenantId,
        name,
        color,
        icon,
        description,
        groupId,
        archived
    });

    return res.json(tag);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { tagId } = req.params;
    const { forceDelete } = req.query;

    await DeleteTagService({
        id: Number(tagId),
        tenantId,
        forceDelete: forceDelete === "true"
    });

    return res.status(204).send();
};

// === COLORS ===

export const colors = async (req: Request, res: Response): Promise<Response> => {
    return res.json(TAG_COLORS);
};

// === TAG GROUPS ===

export const indexGroups = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;

    const groups = await TagGroupService.ListTagGroups({ tenantId });

    return res.json(groups);
};

export const storeGroup = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { name, description, order } = req.body;

    const group = await TagGroupService.CreateTagGroup({
        tenantId,
        name,
        description,
        order
    });

    return res.status(201).json(group);
};

export const updateGroup = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { groupId } = req.params;
    const { name, description, order } = req.body;

    const group = await TagGroupService.UpdateTagGroup({
        id: Number(groupId),
        tenantId,
        name,
        description,
        order
    });

    return res.json(group);
};

export const removeGroup = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { groupId } = req.params;

    await TagGroupService.DeleteTagGroup({
        id: Number(groupId),
        tenantId
    });

    return res.status(204).send();
};

// === ENTITY TAGS ===

export const listEntityTags = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { entityType, entityId } = req.params;

    const tags = await EntityTagService.ListEntityTags({
        entityType: entityType as EntityType,
        entityId: Number(entityId),
        tenantId
    });

    return res.json(tags);
};

export const applyTag = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId, id: userId } = req.user;
    const { entityType, entityId } = req.params;
    const { tagId } = req.body;

    const entityTag = await EntityTagService.ApplyTagToEntity({
        tagId: Number(tagId),
        entityType: entityType as EntityType,
        entityId: Number(entityId),
        tenantId,
        createdBy: Number(userId)
    });

    return res.status(201).json(entityTag);
};

export const removeTag = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { entityType, entityId, tagId } = req.params;

    await EntityTagService.RemoveTagFromEntity({
        tagId: Number(tagId),
        entityType: entityType as EntityType,
        entityId: Number(entityId),
        tenantId
    });

    return res.status(204).send();
};

export const syncTags = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId, id: userId } = req.user;
    const { entityType, entityId } = req.params;
    const { tagIds } = req.body;

    const entityTags = await EntityTagService.SyncEntityTags({
        tagIds: tagIds.map(Number),
        entityType: entityType as EntityType,
        entityId: Number(entityId),
        tenantId,
        createdBy: Number(userId)
    });

    return res.json(entityTags);
};
