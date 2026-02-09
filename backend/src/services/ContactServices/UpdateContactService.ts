import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import RabbitMQService from "../../services/RabbitMQService";
import { v4 as uuidv4 } from "uuid";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import EntityTagService from "../TagServices/EntityTagService";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  walletUserId?: number | null;
  extraInfo?: ExtraInfo[];
  lid?: string;
  tags?: number[];
}

interface Request {
  contactData: ContactData;
  contactId: string;
}

const UpdateContactService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "profilePicUrl", "tenantId"],
    include: ["extraInfo"]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async info => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  const { email: newEmail, name: newName, number: newNumber, walletUserId: newWalletUserId, extraInfo: newExtraInfo, lid } = contactData;

  await contact.update({
    name: newName,
    number: newNumber,
    email: newEmail,
    walletUserId: newWalletUserId,
    lid
  });

  if (contactData.tags) {
    await EntityTagService.SyncEntityTags({
      tagIds: contactData.tags,
      entityType: "contact",
      entityId: contact.id,
      tenantId: contact.tenantId as string
    });
  }

  await contact.reload({
    attributes: ["id", "name", "number", "email", "profilePicUrl", "tenantId"],
    include: ["extraInfo", "tags"]
  });

  try {
    const tenantId = contact.tenantId || 1;
    const whatsapp = await Whatsapp.findOne({
      where: { status: "CONNECTED", tenantId: tenantId.toString() }
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
        `[UpdateContactService] Sent contact.sync command for contact ${contact.id}`
      );
    }
  } catch (err) {
    logger.error(`[UpdateContactService] Error sending sync command: ${err}`);
  }

  return contact;
};

export default UpdateContactService;
