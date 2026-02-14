import { Request, Response } from "express";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import StopWhatsAppSession from "../services/WbotServices/StopWhatsAppSession";
import RestartAllWhatsAppsService from "../services/WbotServices/RestartAllWhatsAppsService";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { usePairingCode, phoneNumber } = req.body;
  const whatsapp = await ShowWhatsAppService(whatsappId);

  // Always force restart on manual start request to clear stuck sessions
  const force = true;

  await StartWhatsAppSession(whatsapp, usePairingCode, phoneNumber, force);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { usePairingCode, phoneNumber } = req.body;

  const { whatsapp } = await UpdateWhatsAppService({
    whatsappId,
    whatsappData: { session: "" }
  });

  // For update/reconnect, we generally force
  const force = true;

  await StartWhatsAppSession(whatsapp, usePairingCode, phoneNumber, force);

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await ShowWhatsAppService(whatsappId);

  await StopWhatsAppSession(whatsapp.id);

  return res.status(200).json({ message: "Session disconnected." });
};

const restartAll = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = req.user;
  await RestartAllWhatsAppsService(tenantId as any);
  return res.status(200).json({ message: "Restarting all sessions." });
};

export default { store, remove, update, restartAll };

