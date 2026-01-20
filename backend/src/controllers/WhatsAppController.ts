import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import AppError from "../errors/AppError";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import Plugin from "../models/Plugin";
import PluginInstallation from "../models/PluginInstallation";

interface WhatsappData {
  name: string;
  queueIds: number[];
  greetingMessage?: string;
  farewellMessage?: string;
  status?: string;
  isDefault?: boolean;
  syncHistory?: boolean;
  syncPeriod?: string;
  keepAlive?: boolean;
  type?: string;
  chatConfig?: any;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { tenantId } = (req as any).user;
  const whatsapps = await ListWhatsAppsService(tenantId);

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    farewellMessage,
    queueIds,
    syncHistory,
    syncPeriod,
    keepAlive,
    type,
    chatConfig
  }: WhatsappData = req.body;

  const { tenantId } = (req as any).user;

  if (type === "webchat") {
    const plugin = await Plugin.findOne({ where: { slug: "webchat" } });
    if (plugin) {
      const installation = await PluginInstallation.findOne({
        where: {
          pluginId: plugin.id,
          tenantId,
          status: "active"
        }
      });

      if (!installation) {
        throw new AppError("Webchat plugin is not active for this tenant.");
      }
    }
  }

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    farewellMessage,
    queueIds,
    syncHistory,
    syncPeriod,
    keepAlive,
    tenantId,
    type,
    chatConfig
  });

  // StartWhatsAppSession(whatsapp); // [REMOVED] Manual connect only

  const io = getIO();
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.emit("whatsapp", {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;

  const whatsapp = await ShowWhatsAppService(whatsappId);

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { tenantId } = (req as any).user;

  if (whatsappData.type === "webchat") {
    const plugin = await Plugin.findOne({ where: { slug: "webchat" } });
    if (plugin) {
      const installation = await PluginInstallation.findOne({
        where: {
          pluginId: plugin.id,
          tenantId,
          status: "active"
        }
      });

      if (!installation) {
        throw new AppError("Webchat plugin is not active for this tenant.");
      }
    }
  }

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId
  });

  const io = getIO();
  io.emit("whatsapp", {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.emit("whatsapp", {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;

  await DeleteWhatsAppService(whatsappId);

  const io = getIO();
  io.emit("whatsapp", {
    action: "delete",
    whatsappId: +whatsappId
  });

  return res.status(200).json({ message: "Whatsapp deleted." });
};
