import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Tenant from "../../models/Tenant";
import Whatsapp from "../../models/Whatsapp";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import EntityTagService from "../TagServices/EntityTagService";

interface Request {
  name: string;
  queueIds?: number[];
  greetingMessage?: string;
  farewellMessage?: string;
  status?: string;
  isDefault?: boolean;
  syncHistory?: boolean;
  syncPeriod?: string;
  keepAlive?: boolean;
  tenantId?: number | string;
  type?: string;
  chatConfig?: any;
  tags?: number[];
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const CreateWhatsAppService = async ({
  name,
  status = "DISCONNECTED",
  queueIds = [],
  greetingMessage,
  farewellMessage,
  isDefault = false,
  syncHistory = false,
  syncPeriod,
  keepAlive,
  tenantId,
  type = "whatsapp",
  chatConfig = {},
  tags
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "This whatsapp name is already used.",
        async value => {
          if (!value) return false;
          const nameExists = await Whatsapp.findOne({
            where: { name: value }
          });
          return !nameExists;
        }
      ),
    isDefault: Yup.boolean().required()
  });

  try {
    await schema.validate({ name, status, isDefault });
  } catch (err) {
    throw new AppError(err.message);
  }

  if (process.env.TENANTS === "true" && tenantId) {
    const tenant = await Tenant.findOne({ where: { id: tenantId } });
    if (tenant) {
      const whatsappCount = await Whatsapp.count({ where: { tenantId } });
      if (whatsappCount >= tenant.maxConnections) {
        throw new AppError("ERR_MAX_CONNECTIONS_REACHED", 403);
      }
    }
  }

  const whatsappFound = await Whatsapp.findOne();

  isDefault = !whatsappFound;

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: { isDefault: true }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  const whatsapp = await Whatsapp.create(
    {
      name,
      status,
      greetingMessage,
      farewellMessage,
      isDefault,
      syncHistory,
      syncPeriod,
      keepAlive,
      tenantId,
      type,
      chatConfig: chatConfig ? JSON.stringify(chatConfig) : null
    },
    { include: ["queues"] }
  );

  await AssociateWhatsappQueue(whatsapp, queueIds);

  if (tags && tags.length > 0) {
    await EntityTagService.BulkApplyTags({
      tagIds: tags,
      entityType: "whatsapp",
      entityId: whatsapp.id,
      tenantId: tenantId ? tenantId.toString() : "1" // Fallback usually not needed if auth middleware works
    });
  }

  return { whatsapp, oldDefaultWhatsapp };
};

export default CreateWhatsAppService;
