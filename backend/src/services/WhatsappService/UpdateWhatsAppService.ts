import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import ShowWhatsAppService from "./ShowWhatsAppService";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import StopWhatsAppSession from "../WbotServices/StopWhatsAppSession";
import { logger } from "../../utils/logger";
import EntityTagService from "../TagServices/EntityTagService";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  farewellMessage?: string;
  queueIds?: number[];
  syncHistory?: boolean; // [NEW]
  syncPeriod?: string;   // [NEW]
  keepAlive?: boolean;   // [NEW]
  type?: string;
  chatConfig?: any;
  tags?: number[];
}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean()
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    farewellMessage,
    queueIds = [],
    syncHistory,
    syncPeriod,
    keepAlive,
    type,
    chatConfig,
    tags
  } = whatsappData;

  logger.info(`UpdateWhatsAppService - ID: ${whatsappId}, Data: ${JSON.stringify(whatsappData)} `); // [DEBUG]


  try {
    await schema.validate({ name, status, isDefault });
  } catch (err) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: { isDefault: true, id: { [Op.not]: whatsappId } }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }

  const whatsapp = await ShowWhatsAppService(whatsappId);

  await whatsapp.update({
    name,
    status,
    session,
    greetingMessage,
    farewellMessage,
    isDefault,
    syncHistory,
    syncPeriod,
    keepAlive,
    type,
    chatConfig: chatConfig !== undefined ? JSON.stringify(chatConfig) : undefined
  });

  // [NEW] If critical settings changed, stop session to force reconnection with new settings
  if (whatsapp.status === "CONNECTED" && (syncHistory !== undefined || syncPeriod !== undefined || keepAlive !== undefined)) {
    // Import dynamically or at top if cycle allows. 
    // Using dynamic import or moving StopWhatsAppSession import to top.
    // Let's assume standard import at top.
  }

  await AssociateWhatsappQueue(whatsapp, queueIds);

  if (tags) {
    await EntityTagService.SyncEntityTags({
      tagIds: tags,
      entityType: "whatsapp",
      entityId: whatsapp.id,
      tenantId: whatsapp.tenantId as string
    });

    // Reload to include tags in returned object if needed, or frontend will refetch/update
    await whatsapp.reload({
      include: ["queues", "tags"]
    });
  }

  // Checks if sync settings were updated and connection is active/opening
  if (syncHistory !== undefined || syncPeriod !== undefined || keepAlive !== undefined) {
    await StopWhatsAppSession(whatsapp.id);
  }

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
