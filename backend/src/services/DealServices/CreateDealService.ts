import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import EntityTagService from "../TagServices/EntityTagService";

interface DealData {
    title: string;
    value?: number;
    priority?: number;
    contactId: number;
    ticketId?: number;
    pipelineId: number;
    stageId?: number;
    tenantId: number | string;
    tags?: number[];
}

const CreateDealService = async (dealData: DealData): Promise<Deal> => {
    const { title, value, priority, contactId, ticketId, pipelineId, stageId, tenantId, tags } = dealData;

    const schema = Yup.object().shape({
        title: Yup.string().required(),
        contactId: Yup.number().required(),
        pipelineId: Yup.number().required()
    });

    try {
        await schema.validate({ title, contactId, pipelineId });
    } catch (err: any) {
        throw new AppError(err.message);
    }

    // Verify contact existence
    const contact = await Contact.findByPk(contactId);
    if (!contact) {
        throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }

    // Optionally verify ticket existence if provided
    if (ticketId) {
        const ticket = await Ticket.findByPk(ticketId);
        if (!ticket) {
            throw new AppError("ERR_NO_TICKET_FOUND", 404);
        }
    }

    const deal = await Deal.create({
        title,
        value,
        priority,
        contactId,
        ticketId,
        pipelineId,
        stageId,
        tenantId
    });

    if (tags && tags.length > 0) {
        await EntityTagService.SyncEntityTags({
            tagIds: tags,
            entityType: 'deal',
            entityId: deal.id,
            tenantId: tenantId as string
        });
    }

    await deal.reload({
        include: ["contact", "ticket", "pipeline", "stage", "tags"]
    });

    return deal;
};

export default CreateDealService;
