import Tag from "../../models/Tag";
import EntityTag, { EntityType } from "../../models/EntityTag";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import { logger } from "../../utils/logger";
import FlowTriggerService from "../FlowServices/FlowTriggerService";
import FlowExecutorService from "../FlowServices/FlowExecutorService";

interface ApplyTagRequest {
    tagId: number;
    entityType: EntityType;
    entityId: number;
    tenantId: string;
    createdBy?: number;
}

interface RemoveTagRequest {
    tagId: number;
    entityType: EntityType;
    entityId: number;
    tenantId: string;
}

interface BulkApplyRequest {
    tagIds: number[];
    entityType: EntityType;
    entityId: number;
    tenantId: string;
    createdBy?: number;
}

interface ListEntityTagsRequest {
    entityType: EntityType;
    entityId: number;
    tenantId: string;
}

/**
 * Aplica uma tag a uma entidade (contact, ticket, deal)
 */
export const ApplyTagToEntity = async ({
    tagId,
    entityType,
    entityId,
    tenantId,
    createdBy
}: ApplyTagRequest): Promise<EntityTag> => {
    // Verificar se a tag existe e pertence ao tenant
    const tag = await Tag.findOne({
        where: { id: tagId, tenantId }
    });

    if (!tag) {
        throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }

    if (tag.archived) {
        throw new AppError("ERR_TAG_ARCHIVED", 400);
    }

    // Verificar se já existe essa associação
    const existing = await EntityTag.findOne({
        where: { tagId, entityType, entityId }
    });

    if (existing) {
        return existing; // Retorna sem erro se já existe
    }

    // Criar associação
    const entityTag = await EntityTag.create({
        tagId,
        entityType,
        entityId,
        createdBy
    });

    // Incrementar contador de uso da tag
    await tag.increment("usageCount");

    // TRIGGER FLOW: Tag Applied
    try {
        const trigger = await FlowTriggerService.findTrigger(
            'tagAdded', // Deve bater com o valor do StartNodeModal
            { tagId },
            tenantId
        );

        if (trigger) {
            // Iniciar fluxo
            // Precisamos do ticketId se a entidade for ticket, ou buscar ultimo ticket se for contato?
            // O FlowExecutor espera um context com ticketId.
            // Se entityType == 'ticket', temos ticketId.
            // Se entityType == 'contact', precisamos achar um ticket aberto ou criar contexto sem ticket (pode falhar se o fluxo exigir ticket)

            let context: any = {
                tagId,
                entityId,
                entityType
            };

            if (entityType === 'ticket') {
                context.ticketId = entityId;
            } else if (entityType === 'contact') {
                context.contactId = entityId;
                // Opcional: tentar achar ticket
            }

            await FlowExecutorService.start(trigger.flowId, context);
            logger.info(`Flow Triggered by Tag Applied: Flow ${trigger.flowId} on ${entityType} ${entityId}`);
        }
    } catch (e) {
        logger.error(`Error triggering flow on tag applied: ${e}`);
    }

    return entityTag;
};

/**
 * Remove uma tag de uma entidade
 */
export const RemoveTagFromEntity = async ({
    tagId,
    entityType,
    entityId,
    tenantId
}: RemoveTagRequest): Promise<void> => {
    // Verificar se a tag pertence ao tenant
    const tag = await Tag.findOne({
        where: { id: tagId, tenantId }
    });

    if (!tag) {
        throw new AppError("ERR_TAG_NOT_FOUND", 404);
    }

    const entityTag = await EntityTag.findOne({
        where: { tagId, entityType, entityId }
    });

    if (!entityTag) {
        return; // Não existe, não faz nada
    }

    await entityTag.destroy();

    // Decrementar contador de uso da tag
    if (tag.usageCount > 0) {
        await tag.decrement("usageCount");
    }
};

/**
 * Aplica múltiplas tags a uma entidade de uma vez
 */
export const BulkApplyTags = async ({
    tagIds,
    entityType,
    entityId,
    tenantId,
    createdBy
}: BulkApplyRequest): Promise<EntityTag[]> => {
    const results: EntityTag[] = [];

    for (const tagId of tagIds) {
        const entityTag = await ApplyTagToEntity({
            tagId,
            entityType,
            entityId,
            tenantId,
            createdBy
        });
        results.push(entityTag);
    }

    return results;
};

/**
 * Sincroniza as tags de uma entidade (remove as não listadas, adiciona as novas)
 */
export const SyncEntityTags = async ({
    tagIds,
    entityType,
    entityId,
    tenantId,
    createdBy
}: BulkApplyRequest): Promise<EntityTag[]> => {
    // Buscar tags atuais
    const currentTags = await EntityTag.findAll({
        where: { entityType, entityId },
        include: [{ model: Tag, as: "tag", where: { tenantId } }]
    });

    const currentTagIds = currentTags.map(et => et.tagId);

    // Tags a remover (estão no atual mas não no novo)
    const toRemove = currentTagIds.filter(id => !tagIds.includes(id));

    // Tags a adicionar (estão no novo mas não no atual)
    const toAdd = tagIds.filter(id => !currentTagIds.includes(id));

    // Remover
    for (const tagId of toRemove) {
        await RemoveTagFromEntity({ tagId, entityType, entityId, tenantId });
    }

    // Adicionar
    for (const tagId of toAdd) {
        await ApplyTagToEntity({ tagId, entityType, entityId, tenantId, createdBy });
    }

    // Retornar lista atualizada
    return EntityTag.findAll({
        where: { entityType, entityId },
        include: [{ model: Tag, as: "tag" }]
    });
};

/**
 * Lista todas as tags de uma entidade
 */
export const ListEntityTags = async ({
    entityType,
    entityId,
    tenantId
}: ListEntityTagsRequest): Promise<Tag[]> => {
    const entityTags = await EntityTag.findAll({
        where: { entityType, entityId },
        include: [
            {
                model: Tag,
                as: "tag",
                where: { tenantId, archived: false }
            }
        ]
    });

    return entityTags.map(et => et.tag);
};

export default {
    ApplyTagToEntity,
    RemoveTagFromEntity,
    BulkApplyTags,
    SyncEntityTags,
    ListEntityTags
};
