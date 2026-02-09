import axios from "axios";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Plugin from "../../models/Plugin";
import PluginInstallation from "../../models/PluginInstallation";
import Setting from "../../models/Setting";
import StopWhatsAppSession from "../WbotServices/StopWhatsAppSession";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (
    whatsapp.status === "CONNECTED" ||
    whatsapp.status === "PAIRING" ||
    whatsapp.status === "OPENING"
  ) {
    throw new AppError("ERR_WAPP_CHECK_BEFORE_DELETE");
  }

  await StopWhatsAppSession(whatsapp.id); // [NEW] Ensure session is stopped in engine

  if (whatsapp.engineType === "papi") {
    const plugin = await Plugin.findOne({ where: { slug: "engine-papi" } });
    if (plugin) {
      const installation = await PluginInstallation.findOne({
        where: {
          pluginId: plugin.id,
          tenantId: whatsapp.tenantId,
          status: "active"
        }
      });

      if (installation) {
        const urlSetting = await Setting.findOne({
          where: { key: "papiUrl", tenantId: whatsapp.tenantId }
        });
        const keySetting = await Setting.findOne({
          where: { key: "papiKey", tenantId: whatsapp.tenantId }
        });

        if (urlSetting?.value && keySetting?.value) {
          try {
            await axios.delete(
              `${urlSetting.value}/api/instances/${whatsapp.id}`,
              {
                headers: {
                  "x-api-key": keySetting.value
                }
              }
            );
          } catch (err) {
            console.error(
              `Failed to delete PAPI instance ${whatsapp.id}:`,
              err.message
            );
          }
        }
      }
    }
  }

  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
