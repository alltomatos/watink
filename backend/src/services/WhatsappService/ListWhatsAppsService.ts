import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const ListWhatsAppsService = async (tenantId?: number | string): Promise<Whatsapp[]> => {
  const whereCondition: any = {};
  if (tenantId) {
    whereCondition.tenantId = tenantId;
  }

  const whatsapps = await Whatsapp.findAll({
    where: whereCondition,
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      }
    ]
  });

  return whatsapps;
};

export default ListWhatsAppsService;
