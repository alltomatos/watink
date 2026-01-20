import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

const RestartAllWhatsAppsService = async (companyId: number): Promise<void> => {
    const whatsapps = await Whatsapp.findAll({
        where: {
            tenantId: companyId
        }
    });

    await Promise.all(
        whatsapps.map(async whatsapp => {
            await StartWhatsAppSession(whatsapp, false, undefined, true);
        })
    );
};

export default RestartAllWhatsAppsService;
