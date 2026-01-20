import Contact from "../../models/Contact";
import RabbitMQService from "../RabbitMQService";
import { Op, Sequelize } from "sequelize";
import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

const BatchEnrichContactsService = async (
    tenantId: number | string
): Promise<{ count: number }> => {
    let count = 0;

    try {
        // 1. Find candidates:
        // - Must verify IS NOT A GROUP
        // - Criteria for incomplete:
        //   a) LID is missing (null)
        //   b) OR Number equals LID (meaning it was created via LID-only flow and hasn't been resolved to a number yet - rare in this codebase but possible)
        //   c) OR RemoteJid contains '@lid' (not used in this codebase typically, but safe to ignore)

        // We stick to: LID is NULL and Number is NOT NULL.
        const contacts = await Contact.findAll({
            where: {
                tenantId,
                isGroup: false,
                [Op.or]: [
                    { lid: null },
                    // Sequelize.where(Sequelize.col("number"), "=", Sequelize.col("lid")) // Safe to add? usually LID != Number
                ],
                number: { [Op.ne]: null as any }, // Must have a number to query
            },
            attributes: ["id", "name", "number", "lid"],
            limit: 1000 // Batch limit to avoid overload
        });

        logger.info(`[BatchEnrich] Found ${contacts.length} candidates for enrichment for tenant ${tenantId}.`);

        for (const contact of contacts) {
            if (!contact.number) continue;

            try {
                await RabbitMQService.publishCommand("wbot.global.contact.sync", {
                    id: uuidv4(),
                    timestamp: Date.now(),
                    type: "contact.sync",
                    payload: {
                        contactId: contact.id,
                        number: contact.number,
                        lid: undefined, // ensure we ask for it
                        sessionId: 1 // TODO: Need specific sessionId logic. Ideally 0 for "any"
                    },
                    tenantId
                });

                count++;
                // Small delay if needed? RabbitMQ handles it, but maybe Engine overload?
                // Let's trust RabbitMQ.
            } catch (e) {
                logger.error(`Failed to enqueue enrich for contact ${contact.id}: ${e}`);
            }
        }

        logger.info(`[BatchEnrich] Enqueued ${count} contacts.`);
        return { count };

    } catch (err) {
        logger.error(`[BatchEnrich] Error: ${err}`);
        throw new Error("ERR_BATCH_ENRICH_CONTACTS");
    }
};

export default BatchEnrichContactsService;
