import { Request, Response } from "express";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import StopWhatsAppSession from "../services/WbotServices/StopWhatsAppSession";
import RestartAllWhatsAppsService from "../services/WbotServices/RestartAllWhatsAppsService";

import { logger } from "../utils/logger";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { usePairingCode, phoneNumber } = req.body;

  try {
    console.log(`[DEBUG] WhatsAppSessionController.store called for whatsappId: ${whatsappId}`);
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }
    const force = true;
    await StartWhatsAppSession(whatsapp, usePairingCode, phoneNumber, force);
  } catch (err) {
    const message = err.message || "Unknown error";
    console.error(`[DEBUG] CRITICAL ERROR in WhatsAppSessionController:`, err);
    logger.error(`Error starting WhatsApp session: ${message}`, err);
    throw err;
  }

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { usePairingCode, phoneNumber } = req.body;

  try {
    const { whatsapp } = await UpdateWhatsAppService({
      whatsappId,
      whatsappData: { session: "" }
    });
    const force = true;
    await StartWhatsAppSession(whatsapp, usePairingCode, phoneNumber, force);
  } catch (err) {
    logger.error(`Error updating/starting WhatsApp session: ${err.message}`, err);
    throw err;
  }

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }
  await StopWhatsAppSession(whatsapp.id);

  return res.status(200).json({ message: "Session disconnected." });
};

const restartAll = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  await RestartAllWhatsAppsService(tenantId as any);
  return res.status(200).json({ message: "Restarting all sessions." });
};

export default { store, remove, update, restartAll };

