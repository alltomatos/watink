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
import axios from "axios";
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
  tags?: number[];
  engineType?: string;
  importOldMessages?: string;
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
    chatConfig,
    tags,
    engineType,
    importOldMessages
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

  if (engineType === "whatsmeow") {
    const plugin = await Plugin.findOne({ where: { slug: "whatsmeow" } });
    if (plugin) {
      const installation = await PluginInstallation.findOne({
        where: {
          pluginId: plugin.id,
          tenantId,
          status: "active"
        }
      });

      if (!installation) {
        throw new AppError("WhatsMeow plugin is not active for this tenant.");
      }
    }
  }

  if (engineType === "papi") {
    const plugin = await Plugin.findOne({ where: { slug: "engine-papi" } });
    if (plugin) {
      const installation = await PluginInstallation.findOne({
        where: {
          pluginId: plugin.id,
          tenantId,
          status: "active"
        }
      });

      if (!installation) {
        throw new AppError("Engine PAPI plugin is not active for this tenant.");
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
    chatConfig,
    tags,
    engineType,
    importOldMessages
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

export const testPapiConnection = async (req: Request, res: Response): Promise<Response> => {
  const { papiUrl, papiKey } = req.body;

  try {
    // PAPI usually has a status endpoint or just listing instances
    await axios.get(`${papiUrl}/api/instances`, {
      headers: {
        "x-api-key": papiKey
      },
      timeout: 5000
    });
    return res.status(200).json({ message: "Connection successful" });
  } catch (err: any) {
    return res.status(400).json({ error: "Connection failed", details: err.message });
  }
};
