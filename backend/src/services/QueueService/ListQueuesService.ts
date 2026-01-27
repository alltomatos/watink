import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const ListQueuesService = async (): Promise<Queue[]> => {
  const queues = await Queue.findAll({
    order: [["name", "ASC"]],
    include: [
      {
        model: Whatsapp,
        as: "whatsapps",
        attributes: ["id", "name"]
      }
    ]
  });

  return queues;
};

export default ListQueuesService;
