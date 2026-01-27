import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import RabbitMQService from "../RabbitMQService";
import { v4 as uuidv4 } from "uuid";
// import axios from "axios";
// import fs from "fs";
// import path, { join } from "path";
// import uploadConfig from "../../config/upload";
import { DownloadProfileImage } from "../../helpers/DownloadProfileImage";
import MergeContactsService from "./MergeContactsService";
import { logger } from "../../utils/logger";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  lid?: string;
  tenantId?: number | string;
  waitEnrichment?: boolean;
  sessionId?: number;
}

export const waitForContactEnrichment = async (contactId: number, isGroup: boolean, tenantId: string | number) => {
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

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = [],
  lid,
  tenantId,
  waitEnrichment = false,
  sessionId
}: Request): Promise<Contact> => {
  if (!tenantId) {
    throw new Error("Tenant ID is required for CreateOrUpdateContactService");
  }
  const isWebchat = rawNumber?.startsWith("webchat-");
  const number = isGroup || isWebchat ? rawNumber : rawNumber?.replace(/[^0-9]/g, "");
  const io = getIO();
  let contact: Contact | null = null;
  const backendUrl = process.env.URL_BACKEND || process.env.BACKEND_URL || "http://localhost:8080";

  // 1. Try to find by LID
  if (lid) {
    contact = await Contact.findOne({ where: { lid, tenantId } });
  }

  // 2. Try to find by Number (only if valid number)
  let contactByNumber: Contact | null = null;
  if (number) {
    contactByNumber = await Contact.findOne({ where: { number, tenantId } });
  }

  // 3. Merge Logic
  if (contact && contactByNumber) {
    if (contact.id === contactByNumber.id) {
      // Same contact found by both ways
    } else {
      // Merge: Prefer contactByNumber (Target), delete contact (Origin - LID-only)
      // Ensure Target has the LID
      if (!contactByNumber.lid && contact.lid) {
        await contactByNumber.update({ lid: contact.lid });
      }

      await MergeContactsService({
        contactIdOrigin: contact.id,
        contactIdTarget: contactByNumber.id,
        tenantId
      });

      contact = contactByNumber;
    }
  } else if (!contact && contactByNumber) {
    contact = contactByNumber;
  }

  // 4. Fallback: Try to find by Name (if still no contact)
  if (!contact && !number && !lid && name) {
    contact = await Contact.findOne({ where: { name, tenantId } });
  }

  if (contact) {
    // Update existing contact
    const updates: any = {};

    if (lid && !contact.lid) updates.lid = lid;
    if (number && !contact.number) updates.number = number;

    // Prevent overwriting group name with JID
    if (isGroup && name) {
      const newNameIsJid = name.includes("@g.us");
      const currentNameIsJid = contact.name?.includes("@g.us") || contact.name === contact.number;

      if (!newNameIsJid || currentNameIsJid) {
        updates.name = name;
      }
    } else if (name) {
      // Individual Contact: Prioritize PushName/Notify if available, OR if current name is placeholder
      // If the new name is just a number, ignore it if we already have a text name
      const newNameIsNumber = name.replace(/\D/g, "") === name || name.includes("@");
      const currentNameIsNumber = contact.name.replace(/\D/g, "") === contact.name || contact.name.includes("@");

      if (!newNameIsNumber || currentNameIsNumber) {
        updates.name = name;
      }
    }

    if (isGroup && !contact.isGroup) updates.isGroup = true;

    // Profile Picture logic with Download
    if (profilePicUrl && profilePicUrl !== contact.profilePicUrl) {
      const filename = await DownloadProfileImage({
        profilePicUrl,
        tenantId,
        contactId: contact.id
      });
      if (filename) {
        // Cache busting: Add version param to force frontend update
        updates.profilePicUrl = `${backendUrl}/public/${tenantId}/contacts/${filename}?v=${new Date().getTime()}`;
      } else if (profilePicUrl) {
        // Fallback to remote URL if download failed
        updates.profilePicUrl = profilePicUrl;
      }
    }

    if (Object.keys(updates).length > 0) {
      await contact.update(updates);
      await contact.reload();
    }

    io.emit("contact", {
      action: "update",
      contact
    });

  } else {
    // Create new contact
    contact = await Contact.create({
      name,
      number: number || null,
      lid: lid || null,
      profilePicUrl: "", // Will update after creation to have ID for filename
      email,
      isGroup,
      extraInfo,
      tenantId
    });

    if (profilePicUrl) {
      const filename = await DownloadProfileImage({
        profilePicUrl,
        tenantId,
        contactId: contact.id
      });

      let finalUrl = profilePicUrl;
      if (filename) {
        // Cache busting
        finalUrl = `${backendUrl}/public/${tenantId}/contacts/${filename}?v=${new Date().getTime()}`;
      }

      await contact.update({ profilePicUrl: finalUrl });
      await contact.reload();
    }

    io.emit("contact", {
      action: "create",
      contact
    });
  }

  // --- BARRIER ENRICHMENT LOGIC ---
  if (waitEnrichment && sessionId && contact) {
    const shouldSync = isGroup
      ? (contact.name === contact.number || !contact.profilePicUrl)
      : (!contact.profilePicUrl || (!contact.lid && !contact.number?.includes("@lid") && !contact.name));

    if (shouldSync) {
      await RabbitMQService.publishCommand(`wbot.${tenantId}.${sessionId}.contact.sync`, {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "contact.sync",
        payload: {
          sessionId,
          contactId: contact.id,
          number: contact.number,
          lid: contact.lid || undefined,
          isGroup
        }
      });

      await waitForContactEnrichment(contact.id, isGroup, tenantId);
      await contact.reload();
    }
  }

  return contact;
};

export default CreateOrUpdateContactService;
