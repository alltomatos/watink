import { Op } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Queue, { DISTRIBUTION_STRATEGIES, DistributionStrategy } from "../../models/Queue";
import ShowQueueService from "./ShowQueueService";

interface QueueData {
  name?: string;
  color?: string;
  greetingMessage?: string;
  distributionStrategy?: DistributionStrategy;
  prioritizeWallet?: boolean;
  whatsappIds?: number[];
}

// Valid distribution strategies for validation
const validStrategies = Object.values(DISTRIBUTION_STRATEGIES);

const UpdateQueueService = async (
  queueId: number | string,
  queueData: QueueData
): Promise<Queue> => {
  const { color, name, distributionStrategy, prioritizeWallet, whatsappIds } = queueData;

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_QUEUE_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameName = await Queue.findOne({
              where: { name: value, id: { [Op.not]: queueId } }
            });

            return !queueWithSameName;
          }
          return true;
        }
      ),
    color: Yup.string()
      .required("ERR_QUEUE_INVALID_COLOR")
      .test("Check-color", "ERR_QUEUE_INVALID_COLOR", async value => {
        if (value) {
          const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
          return colorTestRegex.test(value);
        }
        return true;
      })
      .test(
        "Check-color-exists",
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameColor = await Queue.findOne({
              where: { color: value, id: { [Op.not]: queueId } }
            });
            return !queueWithSameColor;
          }
          return true;
        }
      ),
    distributionStrategy: Yup.string()
      .oneOf(validStrategies, "ERR_QUEUE_INVALID_DISTRIBUTION_STRATEGY")
      .nullable(),
    prioritizeWallet: Yup.boolean().nullable()
  });

  try {
    await queueSchema.validate({ color, name, distributionStrategy, prioritizeWallet });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const queue = await ShowQueueService(queueId);

  await queue.update(queueData);

  if (whatsappIds) {
    await queue.$set("whatsapps", whatsappIds);
  }

  return queue;
};

export default UpdateQueueService;

