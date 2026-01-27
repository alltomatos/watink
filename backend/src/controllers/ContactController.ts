import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { v4 as uuidv4 } from "uuid";
import RabbitMQService from "../services/RabbitMQService";
import BatchEnrichContactsService from "../services/ContactServices/BatchEnrichContactsService";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import ImportContactsService, { ImportContactsService as ImportContactsClass } from "../services/ContactServices/ImportContactsService";

import AppError from "../errors/AppError";
import GetContactService from "../services/ContactServices/GetContactService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo {
  name: string;
  value: string;
}

export interface ContactData {
  name: string;
  number: string;
  email?: string;
  walletUserId?: number | null;
  extraInfo?: ExtraInfo[];
  tags?: number[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, tags } = req.query as any;
  const { tenantId } = req.user;

  // Converter tags para array de números se vier como string ou array
  let tagIds: number[] = [];
  if (tags) {
    if (Array.isArray(tags)) {
      tagIds = tags.map((t: string) => +t);
    } else {
      tagIds = [+tags];
    }
  }

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber,
    tags: tagIds.length > 0 ? tagIds : undefined,
    tenantId
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;

  const contact = await GetContactService({
    name,
    number
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  console.log(`[ContactController.store] Creating contact for user: ${JSON.stringify(req.user)}, tenantId: ${tenantId}, type: ${typeof tenantId}`);

  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace("-", "").replace(" ", "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const validNumber = newContact.number;
  const profilePicUrl = "";
  let name = newContact.name;
  let number = validNumber;
  let email = newContact.email;
  let walletUserId = newContact.walletUserId;
  let extraInfo = newContact.extraInfo;
  let tags = newContact.tags;

  try {
    const contact = await CreateContactService({
      name,
      number,
      email,
      extraInfo,
      profilePicUrl,
      walletUserId,
      tenantId,
      waitEnrichment: true,
      tags
    });

    const io = getIO();
    io.emit("contact", {
      action: "create",
      contact
    });

    return res.status(200).json(contact);
  } catch (err: any) {
    console.error("Error in ContactController.store:", err);
    throw new AppError("INTERNAL_ERR_CREATING_CONTACT: " + err.message, 500);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;

  const contact = await ShowContactService(contactId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    )
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { contactId } = req.params;

  const contact = await UpdateContactService({ contactData, contactId });

  const io = getIO();
  io.emit("contact", {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  await DeleteContactService(contactId);

  const io = getIO();
  io.emit("contact", {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { tenantId } = req.user;

  try {
    const contact = await ShowContactService(contactId);

    await RabbitMQService.publishCommand("wbot.global.contact.sync", {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "contact.sync",
      payload: {
        contactId: +contactId,
        number: contact.number,
        lid: contact.lid || undefined,
        sessionId: 1
      },
      tenantId
    });

    return res.status(200).json({ message: "Contact sync scheduled via RabbitMQ." });
  } catch (error: any) {
    throw new AppError(error.message);
  }
};

export const batchEnrich = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;

  if (!tenantId) {
    throw new AppError("Tenant ID not found in request", 400);
  }

  const { count } = await BatchEnrichContactsService(tenantId);

  return res.status(200).json({ message: `Enrichment scheduled for ${count} contacts.` });
};

/**
 * Import contacts from CSV file
 * POST /contacts/import-csv
 * 
 * Expects multipart/form-data with:
 * - file: CSV file with columns: name, number, email, walletEmail
 * - delimiter: Optional, defaults to ";" (semicolon)
 */
export const importCsv = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tenantId } = req.user;

  if (!tenantId) {
    throw new AppError("Tenant ID not found in request", 400);
  }

  // Check if file was uploaded
  const file = req.file;
  if (!file) {
    throw new AppError("No file uploaded. Please provide a CSV file.", 400);
  }

  // Get delimiter from body (default to semicolon for Brazilian CSVs)
  const delimiter = (req.body.delimiter as string) || ";";

  try {
    const result = await ImportContactsService.importFromBuffer(file.buffer, {
      tenantId,
      delimiter,
      skipHeader: true,
      batchSize: 500
    });

    const io = getIO();
    io.emit("contact", {
      action: "import",
      result
    });

    return res.status(200).json({
      message: `Import completed: ${result.success} of ${result.total} contacts processed`,
      ...result
    });
  } catch (error: any) {
    console.error("[ContactController.importCsv] Error:", error);
    throw new AppError(`Import failed: ${error.message}`, 500);
  }
};

/**
 * Get sample CSV format for reference
 * GET /contacts/import-csv/sample
 */
export const getSampleCsv = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const sampleCsv = ImportContactsClass.getSampleCsv();

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=contacts_sample.csv");

  return res.status(200).send(sampleCsv);
};

