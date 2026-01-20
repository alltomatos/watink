import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";

interface Request {
    contactIdOrigin: number;
    contactIdTarget: number;
    tenantId: number | string;
}

const MergeContactsService = async ({
    contactIdOrigin,
    contactIdTarget,
    tenantId
}: Request): Promise<Contact> => {
    const contactOrigin = await Contact.findOne({
        where: { id: contactIdOrigin, tenantId }
    });

    const contactTarget = await Contact.findOne({
        where: { id: contactIdTarget, tenantId }
    });

    if (!contactOrigin || !contactTarget) {
        throw new Error("ERR_CONTACT_NOT_FOUND_FOR_MERGE");
    }

    // 1. Update Tickets
    await Ticket.update(
        { contactId: contactIdTarget },
        { where: { contactId: contactIdOrigin, tenantId } }
    );

    // 2. Update Messages
    await Message.update(
        { contactId: contactIdTarget },
        { where: { contactId: contactIdOrigin, tenantId } }
    );

    // 3. Merge Data (Prioritize Target, fill with Origin if missing)
    const updates: any = {};
    if (!contactTarget.email && contactOrigin.email) updates.email = contactOrigin.email;
    if (!contactTarget.name && contactOrigin.name) updates.name = contactOrigin.name;
    if (!contactTarget.number && contactOrigin.number) updates.number = contactOrigin.number;
    // if (!contactTarget.profilePicUrl && contactOrigin.profilePicUrl) updates.profilePicUrl = contactOrigin.profilePicUrl; 

    if (Object.keys(updates).length > 0) {
        await contactTarget.update(updates);
    }

    // 4. Delete Origin
    await contactOrigin.destroy();

    logger.info(`Merged contact ${contactIdOrigin} into ${contactIdTarget}`);

    return contactTarget;
};

export default MergeContactsService;
