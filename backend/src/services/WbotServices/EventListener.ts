import { v4 as uuidv4 } from "uuid";
import { Envelope, QrCodePayload, SessionStatusPayload, MessageReceivedPayload, PairingCodePayload, ContactUpdatePayload, MessageReactionPayload, MessageRevokePayload } from "../../microservice/contracts";
import RabbitMQService from "../RabbitMQService";
import { logger } from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { DownloadProfileImage } from "../../helpers/DownloadProfileImage";
import Ticket from "../../models/Ticket";
import Setting from "../../models/Setting";

const getSessionId = (sessionId: string | number): number => {
  return parseInt(String(sessionId).split("-")[0], 10);
};

export const EventListener = async () => {
  const routingKeys = [
    "wbot.*.*.session.qrcode",
    "wbot.*.*.session.pairingcode",
    "wbot.*.*.session.status",
    "wbot.*.*.message.received",
    "wbot.*.*.message.reaction",
    "wbot.*.*.message.reaction",
    "wbot.*.*.contact.update",
    "wbot.*.*.message.ack",
    "wbot.*.*.message.revoke"
  ];

  await RabbitMQService.consumeEvents("api.events.process", routingKeys, async (msg: Envelope) => {
    logger.info(`Event received: ${msg.type}`);

    switch (msg.type) {
      case "session.qrcode":
        await handleQrCode(msg.payload as QrCodePayload);
        break;
      case "session.pairingcode":
        await handlePairingCode(msg.payload as PairingCodePayload);
        break;
      case "session.status":
        await handleSessionStatus(msg.payload as SessionStatusPayload);
        break;
      case "message.received":
        await handleMessageReceived(msg.payload as MessageReceivedPayload, msg.tenantId);
        break;
      case "message.reaction":
        await handleMessageReaction(msg.payload as MessageReactionPayload, msg.tenantId);
        break;
      case "contact.update":
        await handleContactUpdate(msg.payload as ContactUpdatePayload, msg.tenantId);
        break;
      case "message.ack":
        await handleMessageAck(msg.payload as any, msg.tenantId);
        break;
      case "message.revoke":
        await handleMessageRevoke(msg.payload as MessageRevokePayload, msg.tenantId);
        break;
      default:
        logger.warn(`Unknown event type: ${msg.type}`);
    }
  });
};

const handleQrCode = async (payload: QrCodePayload) => {
  const io = getIO();
  await Whatsapp.update(
    { qrcode: payload.qrcode, status: "QRCODE" },
    { where: { id: getSessionId(payload.sessionId) } }
  );

  io.emit(`whatsappSession`, {
    action: "update",
    session: { id: getSessionId(payload.sessionId), qrcode: payload.qrcode, status: "QRCODE" }
  });
};

const handlePairingCode = async (payload: PairingCodePayload) => {
  const io = getIO();

  io.emit(`whatsappSession`, {
    action: "update",
    session: { id: getSessionId(payload.sessionId), pairingCode: payload.pairingCode, status: "PAIRING" }
  });
};

import { RedisService } from "../RedisService";

const handleSessionStatus = async (payload: SessionStatusPayload) => {
  const io = getIO();

  const updateData: any = { status: payload.status, qrcode: "" };
  if (payload.number) updateData.number = payload.number;
  if (payload.profilePicUrl) updateData.profilePicUrl = payload.profilePicUrl;

  await Whatsapp.update(
    updateData,
    { where: { id: getSessionId(payload.sessionId) } }
  );

  // REDIS CACHE IMPLEMENTATION
  try {
    const redis = RedisService.getInstance();
    const statusKey = `session:status:${getSessionId(payload.sessionId)}`;
    // Cache the status payload for quick retrieval
    // We store the full payload or just the status string? 
    // Plan said "session:status:{id} exists and has correct value"
    // Let's store a simple JSON object
    await redis.setValue(statusKey, JSON.stringify({
      status: payload.status,
      number: payload.number,
      profilePicUrl: payload.profilePicUrl,
      updatedAt: Date.now()
    }));
  } catch (err) {
    logger.error(`Failed to cache session status in Redis: ${err}`);
  }

  io.emit(`whatsappSession`, {
    action: "update",
    session: {
      id: getSessionId(payload.sessionId),
      status: payload.status,
      number: payload.number,
      profilePicUrl: payload.profilePicUrl
    }
  });
};

import MergeContactsService from "../ContactServices/MergeContactsService";
import { Op } from "sequelize";

// ... previous imports

const handleContactUpdate = async (payload: ContactUpdatePayload, tenantId: string | number) => {
  logger.info(`[EventListener] Received contact.update for ${payload.number} (ID: ${payload.contactId})`);
  const { contactId, number, profilePicUrl, pushName, lid, isGroup, sessionId } = payload;

  if (!tenantId && sessionId) {
    const whatsapp = await Whatsapp.findByPk(getSessionId(sessionId));
    if (whatsapp) {
      tenantId = whatsapp.tenantId;
    }
  }

  const backendUrl = process.env.URL_BACKEND || process.env.BACKEND_URL || "http://localhost:8080";

  let contact: Contact | null = null;

  if (contactId) {
    contact = await Contact.findByPk(contactId);
  }

  // If no contact found by ID (or no ID provided), try to find by LID or Number
  if (!contact) {
    if (lid) {
      contact = await Contact.findOne({ where: { lid, tenantId } });
    }
    if (!contact && number) {
      // Try finding by basic number or remoteJid equivalent
      contact = await Contact.findOne({
        where: {
          [Op.or]: [
            { number: number }
          ],
          tenantId
        }
      });
    }
  }

  if (contact) {
    // 1. Check for LID Duplication/Collision
    if (lid && contact.lid && lid !== contact.lid) {
      const duplicate = await Contact.findOne({
        where: {
          lid: lid,
          tenantId: contact.tenantId, // Use contact's tenant to be safe
          id: { [Op.ne]: contact.id } // exclude self
        }
      });

      if (duplicate) {
        logger.info(`[EventListener] LID collision detected: ${lid}. Merging ${contact.id} into ${duplicate.id}`);

        await MergeContactsService({
          contactIdOrigin: contact.id,
          contactIdTarget: duplicate.id,
          tenantId: contact.tenantId
        });

        // After merge, the origin contact is destroyed. We stop here.
        return;
      }
    }

    // 2. Normal Update
    const updates: any = {};

    if (profilePicUrl) {
      const filename = await DownloadProfileImage({
        profilePicUrl,
        tenantId,
        contactId: contact.id
      });
      if (filename) {
        // Cache busting
        updates.profilePicUrl = `${backendUrl}/public/${tenantId}/contacts/${filename}?v=${new Date().getTime()}`;
      } else {
        updates.profilePicUrl = profilePicUrl;
      }
    }
    if (lid) updates.lid = lid;
    if (pushName) updates.name = pushName; // Optionally update name if available

    if (Object.keys(updates).length > 0) {
      await contact.update(updates);

      const io = getIO();
      io.emit("contact", {
        action: "update",
        contact
      });
    }
  } else {
    // Optional: Create contact if it doesn't exist? 
    // For now, we only update existing contacts to avoid polluting DB with random group updates if the user isn't interacting with them.
    // However, for groups we are part of, we probably want them? 
    // Let's stick to updating existing ones for now to be safe.
  }
};

const handleMessageReceived = async (payload: MessageReceivedPayload, tenantId: string | number) => {
  const { message, sessionId } = payload;

  if (message.from === "status@broadcast") {
    return;
  }

  logger.info(`[EventListener] handleMessageReceived: ${JSON.stringify(payload)}`);

  const whatsapp = await Whatsapp.findByPk(getSessionId(sessionId));
  if (!whatsapp) return;

  if (!tenantId && whatsapp.tenantId) {
    tenantId = whatsapp.tenantId;
  }

  if (!tenantId) {
    logger.error(`[EventListener] handleMessageReceived: Tenant ID is missing for session ${sessionId}`);
    return;
  }

  // Deduplication handling for Optimistic UI
  // If we receive 'originalId', it means this message corresponds to a pending message (UUID) created by Backend.
  // We must DELETE the pending message so the new one (WA ID) can replace it in the frontend.
  let preservedBody: string | null = null;
  let preservedMediaUrl: string | null = null;
  let preservedMediaType: string | null = null;
  let preservedCreatedAt: Date | null = null;

  if (message.originalId) {
    if (message.originalId === message.id) {
      logger.info(`[EventListener] handleMessageReceived - Deduping: IDs match (${message.id}). Skipping destruction.`);

      const existingMsg = await Message.findByPk(message.id);
      if (existingMsg) {
        preservedBody = existingMsg.body;
        preservedMediaUrl = existingMsg.getDataValue("mediaUrl");
        preservedMediaType = existingMsg.mediaType;
        preservedCreatedAt = existingMsg.createdAt;
      }
    } else {
      logger.info(`[EventListener] handleMessageReceived - Deduping: Found originalId ${message.originalId}. Processing replacement.`);
      try {
        const pendingMessage = await Message.findByPk(message.originalId);
        if (pendingMessage) {
          // PRESERVE: Capture data from pending message before destroying
          preservedBody = pendingMessage.body;
          preservedMediaUrl = pendingMessage.getDataValue("mediaUrl");
          preservedMediaType = pendingMessage.mediaType;
          preservedCreatedAt = pendingMessage.createdAt;

          await pendingMessage.destroy();
          logger.info(`[EventListener] Pending message ${message.originalId} destroyed successfully.`);

          // Emit deletion event to frontend to remove the clock icon
          const io = getIO();
          io.to(pendingMessage.ticketId.toString()).emit(`appMessage`, {
            action: "delete",
            messageId: message.originalId
          });
        } else {
          logger.warn(`[EventListener] Pending message ${message.originalId} not found in DB.`);
        }
      } catch (dedupeErr) {
        logger.error(`[EventListener] Error deleting pending message ${message.originalId}: ${dedupeErr}`);
      }
    }
  }

  let groupContact: Contact | undefined;
  let msgContact: Contact | undefined;

  if (message.isGroup) {
    // 1. Group Contact (Ticket Owner)
    const groupData = {
      name: message.from, // TODO: Fetch real group subject if possible
      number: message.from.replace(/\D/g, ""),
      isGroup: true,
      tenantId
    };

    // We don't want to overwrite the group name with JID if it already exists and has a name
    // CreateOrUpdateContactService overwrites name. Ideally we should check this.
    // For now, passing message.from as name is standard behavior if name not known.
    (groupData as any).waitEnrichment = true;
    (groupData as any).sessionId = sessionId;
    groupContact = await CreateOrUpdateContactService(groupData as any);

    // 2. Participant Contact (Sender)
    const participant = message.participant || "";

    // Logging diagnostic for missing participant
    if (!participant) {
      logger.error(`Group message ${message.id} from ${message.from} has NO participant! PushName: ${message.pushName}`);
    }

    const participantNumber = participant.replace(/\D/g, "");

    // Check if we already have this participant as a contact
    let savedParticipant = await Contact.findOne({
      where: {
        number: participantNumber,
        tenantId
      }
    });

    if (savedParticipant) {
      msgContact = savedParticipant;
    } else {
      // DOES NOT EXIST: Treat as Group Contact for the purpose of Ticket/Message linking context
      // We do NOT create a contact for them to avoid pollution.
      msgContact = groupContact;
    }
  } else {
    // Individual Contact
    const isLid = message.from.includes("@lid");
    const isWebchat = message.from.startsWith("webchat-");
    const number = isWebchat ? message.from : message.from.replace(/\D/g, "");
    const providedLid = message.senderLid;

    const contactData: any = {
      number: providedLid ? number : (isLid ? null : (number || null)),
      lid: providedLid || (isLid ? message.from : undefined),
      isGroup: false,
      tenantId,
      waitEnrichment: true,
      sessionId
    };

    // Only update name and pfp if message is NOT from me (incoming)
    if (!message.fromMe) {
      contactData.name = message.pushName || message.from;
      contactData.profilePicUrl = message.profilePicUrl;
    } else {
      // If fromMe, use the number/address as name just for creation if it doesn't exist
      contactData.name = message.from;
    }

    msgContact = await CreateOrUpdateContactService(contactData);
  }

  // FIX: Se a mensagem veio com timestamp inválido (0) mas temos a data original de criação, restauramos.
  if (preservedCreatedAt && (!message.timestamp || message.timestamp * 1000 < 1577836800000)) { // < 2020
    logger.warn(`[EventListener] Timestamp fixed for msg ${message.id}: ${message.timestamp} -> ${preservedCreatedAt}`);
    message.timestamp = Math.floor(preservedCreatedAt.getTime() / 1000);
  }

  // --- NOVA LÓGICA DE FILTRO DE TICKET ---

  // 1. Validar Timestamp
  const hasValidTimestamp = message.timestamp && message.timestamp * 1000 > 1577836800000;

  // 2. Calcular idade da mensagem
  // Se não tem timestamp válido e não foi preservado (pendente), assumimos que é MUITO antiga/inválida.
  // Se tem timestamp, verificamos se é maior que 24 horas.
  const isOldMessage = !preservedCreatedAt && (
    !hasValidTimestamp ||
    (Date.now() - (message.timestamp * 1000) > 1000 * 60 * 60 * 24) // 24 hours
  );

  // Lógica de Fuso Horário (opcional para logs ou futuro ajuste fino)
  // const timezoneSetting = await Setting.findOne({ where: { key: "timezone", tenantId } });
  // const timezone = timezoneSetting?.value || "America/Sao_Paulo";

  // Mensagens históricas (ou sem data) não criam ticket novo
  if (isOldMessage) {
    logger.info(`[EventListener] Old/Historic message detected (${message.id}). Timestamp: ${message.timestamp}. Archiving without opening ticket.`);

    let ticketForMessage: Ticket | null = await Ticket.findOne({
      where: {
        contactId: (groupContact || msgContact).id,
        whatsappId: whatsapp.id,
        tenantId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (!ticketForMessage) {
      logger.info(`[EventListener] Old message ${message.id} has no ticket. Creating USED closed ticket to save history.`);

      ticketForMessage = await Ticket.create({
        contactId: groupContact ? groupContact.id : msgContact.id,
        status: "closed",
        isGroup: !!groupContact,
        unreadMessages: 0,
        whatsappId: whatsapp.id,
        tenantId
      });
    }

    if (ticketForMessage) {
      if (ticketForMessage.status === "open" || ticketForMessage.status === "pending") {
        // Se já existe ticket aberto, salvamos nele sem problemas.
        logger.info(`[EventListener] Check: Message ${message.id} is old, but ticket ${ticketForMessage.id} is ${ticketForMessage.status}. appending...`);
      } else {
        logger.info(`[EventListener] Saving old message ${message.id} to CLOSED ticket ${ticketForMessage.id}.`);
      }

      const msgDataVal = {
        id: message.id,
        ticketId: ticketForMessage.id,
        contactId: msgContact.id,
        body: preservedBody || message.body,
        fromMe: message.fromMe,
        read: true, // Mensagens antigas são marcadas como lidas
        mediaType: preservedMediaType || message.type,
        mediaUrl: preservedMediaUrl || message.mediaUrl,
        timestamp: hasValidTimestamp ? message.timestamp * 1000 : new Date().getTime(), // Fallback to now if invalid just for DB constaint, but logic handled it
        createdAt: hasValidTimestamp ? new Date(message.timestamp * 1000) : new Date(),
        participant: message.participant,
        dataJson: message,
        quotedMsgId: message.quotedMsgId,
        ack: 3, // Mensagens antigas assumem ACK = read
        tenantId
      };

      // Processar mídia se houver
      if (message.hasMedia && message.mediaData && !preservedMediaUrl) {
        try {
          const { join } = require("path");
          const { writeFile } = require("fs").promises;
          const uploadConfig = require("../../config/upload").default;
          const mimetype = message.mimetype || "";
          const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
          const filename = `${new Date().getTime()}-${message.id}.${ext}`;
          const tenantFolder = join(uploadConfig.directory, tenantId.toString());
          if (!require("fs").existsSync(tenantFolder)) {
            require("fs").mkdirSync(tenantFolder, { recursive: true });
          }
          const filePath = join(tenantFolder, filename);
          const buffer = Buffer.from(message.mediaData, "base64");
          await writeFile(filePath, buffer);
          (msgDataVal as any).mediaUrl = `${tenantId}/${filename}`;
          if (message.type === "media") {
            if (mimetype.startsWith("image/")) (msgDataVal as any).mediaType = "image";
            else if (mimetype.startsWith("video/")) (msgDataVal as any).mediaType = "video";
            else if (mimetype.startsWith("audio/")) (msgDataVal as any).mediaType = "audio";
            else (msgDataVal as any).mediaType = "document";
          }
        } catch (err) {
          logger.error(`Error saving media for old message ${message.id}: ${err}`);
        }
      }

      await CreateMessageService({ messageData: msgDataVal as any });
    }

    return; // Stop here, do not create pending ticket
  }

  // Apenas para mensagens NOVAS - criar ticket pending
  const ticket = await FindOrCreateTicketService(
    groupContact || msgContact,
    whatsapp.id,
    1, // Unread messages
    tenantId,
    groupContact
  );

  let creationDate = new Date(message.timestamp * 1000);

  // FIX: Prioritize preservedCreatedAt to avoid message jumping in Optimistic UI
  if (preservedCreatedAt) {
    creationDate = preservedCreatedAt;
    logger.info(`[EventListener] Restoring preserved createdAt for message ${message.id}: ${creationDate}`);
  } else {
    // If no preserved timestamp, check for invalid dates (1970)
    if (creationDate.getFullYear() < 2020) {
      creationDate = new Date();
      logger.info(`[EventListener] Invalid timestamp ${message.timestamp}. using NOW: ${creationDate}`);
    }
  }

  const msgData = {
    id: message.id,
    ticketId: ticket.id,
    contactId: msgContact.id,
    body: preservedBody || message.body,
    fromMe: message.fromMe,
    read: message.fromMe || false,
    mediaType: preservedMediaType || message.type,
    mediaUrl: preservedMediaUrl || message.mediaUrl,
    timestamp: creationDate.getTime(), // Use sanitized timestamp
    createdAt: creationDate, // Fix Timestamp
    participant: message.participant,
    dataJson: message, // Store full payload including urlPreview and pushName
    quotedMsgId: message.quotedMsgId,
    ack: message.status || message.ack || 0,
    tenantId
  };

  // If this is an existing sent message, we should not revert the ACK if it is already higher
  if (message.fromMe) {
    const currentMsg = await Message.findByPk(message.id);
    if (currentMsg && currentMsg.ack > msgData.ack) {
      msgData.ack = currentMsg.ack;
    }
  }

  // Logic to handle media that arrived from Engine (Microservice)
  // Only process new media if we don't have a preserved one
  if (message.hasMedia && message.mediaData && !preservedMediaUrl) {
    try {
      const { join } = require("path");
      const { writeFile } = require("fs").promises;
      const uploadConfig = require("../../config/upload").default;

      // Deduce extension
      const mimetype = message.mimetype || "";
      const ext = mimetype.split("/")[1]?.split(";")[0] || "bin";
      const filename = `${new Date().getTime()}-${message.id}.${ext}`;

      const tenantFolder = join(uploadConfig.directory, tenantId.toString());
      if (!require("fs").existsSync(tenantFolder)) {
        require("fs").mkdirSync(tenantFolder, { recursive: true });
      }

      const filePath = join(tenantFolder, filename);
      const buffer = Buffer.from(message.mediaData, "base64");

      await writeFile(filePath, buffer);

      msgData.mediaUrl = `${tenantId}/${filename}`;

      // Fix mediaType to be more specific if Engine sent "media"
      if (message.type === "media") {
        if (mimetype.startsWith("image/")) msgData.mediaType = "image";
        else if (mimetype.startsWith("video/")) msgData.mediaType = "video";
        else if (mimetype.startsWith("audio/")) msgData.mediaType = "audio";
        else msgData.mediaType = "document";
      }
    } catch (err) {
      logger.error(`Error saving media for message ${message.id}: ${err}`);
      // Fallback: Don't block message creation, but it will lack media
    }
  }

  await CreateMessageService({ messageData: msgData as any });
};

// Helper function for Poll Barrier
const waitForContactEnrichment = async (contactId: number, isGroup: boolean, tenantId: string | number) => {
  const MAX_WAIT_MS = 5000; // 5 seconds max
  const POLLING_INTERVAL = 500;
  let waited = 0;

  logger.info(`[Barrier] Waiting for enrichment of contact ${contactId} (Group: ${isGroup})...`);

  // Helper sleep
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  while (waited < MAX_WAIT_MS) {
    const contact = await Contact.findByPk(contactId);

    if (!contact) return; // Should not happen

    let isReady = false;

    if (isGroup) {
      // Ready if has Photo AND Name is not raw number
      const hasPhoto = !!contact.profilePicUrl;
      const hasRealName = contact.name && contact.name !== contact.number;
      isReady = !!(hasPhoto && hasRealName);
    } else {
      // Ready if has Photo AND (Name is not number)
      // Note: pushName is already merged into 'name' by CreateOrUpdateContactService logic
      const hasPhoto = !!contact.profilePicUrl;
      const hasRealName = contact.name && contact.name !== contact.number;
      isReady = !!(hasPhoto && hasRealName);
    }

    if (isReady) {
      logger.info(`[Barrier] Contact ${contactId} enriched after ${waited}ms!`);
      return;
    }

    await sleep(POLLING_INTERVAL);
    waited += POLLING_INTERVAL;
  }

  logger.warn(`[Barrier] Timeout waiting for enrichment of contact ${contactId} after ${MAX_WAIT_MS}ms. Proceeding anyway.`);
};

const handleMessageReaction = async (payload: MessageReactionPayload, tenantId: string | number) => {
  try {
    const { messageId, reaction, sender, timestamp, sessionId } = payload;

    if (!tenantId && sessionId) {
      const whatsapp = await Whatsapp.findByPk(getSessionId(sessionId));
      if (whatsapp) {
        tenantId = whatsapp.tenantId;
      }
    }

    logger.info(`[EventListener] Received reaction for message ${messageId}: ${reaction} from ${sender}`);

    const message = await Message.findOne({
      where: { id: messageId, tenantId }
    });

    if (!message) {
      logger.warn(`[EventListener] Message ${messageId} not found for reaction update.`);
      return;
    }

    // Update reactions JSON
    // Structure: [{ sender: string, text: string, timestamp: number }]
    let currentReactions: any[] = (message.reactions as any[]) || [];

    // Remove previous reaction from this sender if exists
    currentReactions = currentReactions.filter(r => r.sender !== sender);

    // If reaction is not empty, add new one
    // WhatsApp sends empty string when removing a reaction
    if (reaction) {
      currentReactions.push({
        sender,
        text: reaction,
        timestamp
      });
    }

    await message.update({ reactions: currentReactions });

    // Emit via Socket.IO
    const io = getIO();
    io.to(message.ticketId.toString()).emit(`appMessage`, {
      action: "update",
      message: message
    });

  } catch (err) {
    logger.error(`[EventListener] Error handling message reaction: ${err}`);
  }
};

const handleMessageAck = async (payload: { messageId: string; ack: number; sessionId: number }, tenantId: string | number) => {
  try {
    const { messageId, ack, sessionId } = payload;

    if (!tenantId && sessionId) {
      const whatsapp = await Whatsapp.findByPk(getSessionId(sessionId));
      if (whatsapp) {
        tenantId = whatsapp.tenantId;
      }
    }

    logger.info(`[EventListener] handleMessageAck: Processing ACK ${ack} for msg ${messageId}`);

    // Simple retry logic for race condition (ACK before Message Creation)
    // Try up to 10 times with 500ms delay (5 seconds total)
    let message: Message | null = null;

    for (let i = 0; i < 10; i++) {
      message = await Message.findOne({
        where: { id: messageId, tenantId }
      });

      if (message) break;

      if (i === 0) logger.info(`[EventListener] Message ${messageId} not found for ACK update. Starting retries...`);
      await new Promise(r => setTimeout(r, 500));
    }

    if (!message) {
      logger.warn(`[EventListener] Message ${messageId} not found after retries. ACK ${ack} lost.`);
      return;
    }

    // Only update if new ACK is higher than current to prevent regression
    if (ack > message.ack) {
      await message.update({ ack });

      const io = getIO();
      io.to(message.ticketId.toString()).emit(`appMessage`, {
        action: "update",
        message: message
      });
    }

  } catch (err) {
    logger.error(`[EventListener] Error handling message ACK: ${err}`);
  }
};

const handleMessageRevoke = async (payload: MessageRevokePayload, tenantId: string | number) => {
  try {
    const { messageId, sessionId, participant } = payload;

    if (!tenantId && sessionId) {
      const whatsapp = await Whatsapp.findByPk(getSessionId(sessionId));
      if (whatsapp) {
        tenantId = whatsapp.tenantId;
      }
    }

    logger.info(`[EventListener] handleMessageRevoke: Revoking msg ${messageId} (by ${participant})`);

    const message = await Message.findOne({
      where: { id: messageId, tenantId }
    });

    if (!message) {
      logger.warn(`[EventListener] Message ${messageId} not found for revocation.`);
      return;
    }

    // Update isDeleted and store deleter info in dataJson
    // We preserve the original body in the DB, but frontend must know it's deleted.
    const currentDataJson = (message.dataJson as object) || {};

    await message.update({
      isDeleted: true,
      dataJson: {
        ...currentDataJson,
        deletedBy: participant
      }
    });

    const io = getIO();
    io.to(message.ticketId.toString()).emit(`appMessage`, {
      action: "update",
      message: message
    });

  } catch (err) {
    logger.error(`[EventListener] Error handling message revocation: ${err}`);
  }
};
