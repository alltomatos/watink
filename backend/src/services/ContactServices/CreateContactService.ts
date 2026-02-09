import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import RabbitMQService from "../../services/RabbitMQService";
import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import EntityTagService from "../TagServices/EntityTagService";

import { waitForContactEnrichment } from "./CreateOrUpdateContactService";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  walletUserId?: number | null;
  extraInfo?: ExtraInfo[];
  tenantId?: string;
  waitEnrichment?: boolean;
  tags?: number[];
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  walletUserId,
  extraInfo = [],
  tenantId,
  waitEnrichment = false, // Default false to maintain backward compat unless requested
  tags
}: Request): Promise<Contact> => {
  if (!tenantId) {
    throw new AppError("Tenant ID is required for creating a contact.", 403);
  }

  const numberExists = await Contact.findOne({
    where: { number, tenantId }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number,
      email,
      walletUserId,
      extraInfo,
      tenantId
    },
    {
      include: ["extraInfo"]
    }
  );

  if (tags && tags.length > 0) {
    await EntityTagService.BulkApplyTags({
      tagIds: tags,
      entityType: "contact",
      entityId: contact.id,
      tenantId
    });
  }

  try {
    const whatsapp = await Whatsapp.findOne({
      where: { status: "CONNECTED", tenantId }
    });

    if (whatsapp) {
      await RabbitMQService.publishCommand(
        `wbot.${tenantId}.${whatsapp.id}.${whatsapp.engineType}.contact.sync`,
        {
          id: uuidv4(),
          timestamp: Date.now(),
          type: "contact.sync",
          payload: {
            contactId: contact.id,
            number: contact.number,
            sessionId: whatsapp.id
          },
          tenantId
        }
      );
      logger.info(
        `[CreateContactService] Sent contact.sync command for contact ${contact.id}`
      );

      // BARRIER LOGIC
      if (waitEnrichment) {
        // Check if we need to wait (if name is raw number and no pfp)
        // Actually, a newly created contact here ALWAYS likely needs enrichment unless user provided heavy data.
        // But even if user provided data, we might want to sync with WhatsApp to get real PFP.
        // We wait if asked.
        await waitForContactEnrichment(contact.id, false, tenantId); // isGroup false for now as this service seems to be for manual scalar contacts?
        // To be safe, manual contacts are usually individuals. If groups are allowed here, we need to check isGroup from body?
        // Contact model has default isGroup=false.

        await contact.reload();
      }

    } else {
      logger.warn(
        `[CreateContactService] No connected whatsapp found for tenant ${tenantId}. Skipping sync.`
      );
    }
  } catch (err) {
    logger.error(`[CreateContactService] Error sending sync command: ${err}`);
  }

  return contact;
};

export default CreateContactService;
