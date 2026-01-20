import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Queue, { DISTRIBUTION_STRATEGIES, DistributionStrategy } from "../../models/Queue";

interface QueueData {
  name: string;
  color: string;
  greetingMessage?: string;
  distributionStrategy?: DistributionStrategy;
  prioritizeWallet?: boolean;
}

// Valid distribution strategies for validation
const validStrategies = Object.values(DISTRIBUTION_STRATEGIES);

const CreateQueueService = async (queueData: QueueData): Promise<Queue> => {
  const { color, name, distributionStrategy, prioritizeWallet } = queueData;

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .required("ERR_QUEUE_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_QUEUE_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameName = await Queue.findOne({
              where: { name: value }
            });

            return !queueWithSameName;
          }
          return false;
        }
      ),
    color: Yup.string()
      .required("ERR_QUEUE_INVALID_COLOR")
      .test("Check-color", "ERR_QUEUE_INVALID_COLOR", async value => {
        if (value) {
          const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
          return colorTestRegex.test(value);
        }
        return false;
      })
      .test(
        "Check-color-exists",
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameColor = await Queue.findOne({
              where: { color: value }
            });
            return !queueWithSameColor;
          }
          return false;
        }
      ),
    distributionStrategy: Yup.string()
      .oneOf(validStrategies, "ERR_QUEUE_INVALID_DISTRIBUTION_STRATEGY")
      .default("MANUAL"),
    prioritizeWallet: Yup.boolean().default(false)
  });

  try {
    await queueSchema.validate({ color, name, distributionStrategy, prioritizeWallet });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const queue = await Queue.create(queueData);

  return queue;
};

export default CreateQueueService;

