import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const ShowQueueService = async (queueId: number | string): Promise<Queue> => {
  const queue = await Queue.findByPk(queueId, {
    include: [
      {
        model: Whatsapp,
        as: "whatsapps",
        attributes: ["id", "name"]
      }
    ]
  });

  if (!queue) {
    throw new AppError("ERR_QUEUE_NOT_FOUND");
  }

  return queue;
};

export default ShowQueueService;
