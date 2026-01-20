import { Request, Response } from "express";
import * as Yup from "yup";
import { v4 as uuidv4 } from "uuid";
import AppError from "../errors/AppError";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import Message from "../models/Message";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import RabbitMQService from "../services/RabbitMQService";

type WhatsappData = {
  whatsappId: number;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

interface ContactData {
  number: string;
}

const createContact = async (
  whatsappId: number | undefined,
  newContact: string
) => {
  // Basic cleaning only - validation happens in Engine
  const number = newContact.replace(/\D/g, "");

  let whatsapp: Whatsapp | null;

  if (whatsappId === undefined) {
    whatsapp = await GetDefaultWhatsApp();
  } else {
    whatsapp = await Whatsapp.findByPk(whatsappId);

    if (whatsapp === null) {
      throw new AppError(`whatsapp #${whatsappId} not found`);
    }
  }

  const contactData = {
    name: `${number}`,
    number,
    profilePicUrl: "", // Will be fetched async
    isGroup: false,
    tenantId: whatsapp.tenantId
  };

  const contact = await CreateOrUpdateContactService(contactData);

  const createTicket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    1,
    whatsapp.tenantId
  );

  const ticket = await ShowTicketService(createTicket.id);

  SetTicketMessagesAsRead(ticket);

  return ticket;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  const { whatsappId }: WhatsappData = req.body;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const contactAndTicket = await createContact(whatsappId, newContact.number);

  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        // Send via RabbitMQ
        await RabbitMQService.publishCommand(`wbot.${contactAndTicket.tenantId}.${contactAndTicket.whatsappId}.message.send.media`, {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: contactAndTicket.tenantId,
          type: "message.send.media",
          payload: {
            sessionId: contactAndTicket.whatsappId,
            to: `${contactAndTicket.contact.number}@${contactAndTicket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            body: body,
            media: {
              mimetype: media.mimetype,
              filename: media.originalname,
              path: media.path
            },
            ticketId: contactAndTicket.id
          }
        });
      })
    );
  } else {
    // Send Text via RabbitMQ
    await RabbitMQService.publishCommand(`wbot.${contactAndTicket.tenantId}.${contactAndTicket.whatsappId}.message.send.text`, {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId: contactAndTicket.tenantId,
      type: "message.send.text",
      payload: {
        sessionId: contactAndTicket.whatsappId,
        to: `${contactAndTicket.contact.number}@${contactAndTicket.isGroup ? "g.us" : "s.whatsapp.net"}`,
        text: body,
        quotedMsg,
        ticketId: contactAndTicket.id
      }
    });
  }

  return res.send({ status: "SUCCESS" });
};
