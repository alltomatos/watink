import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";

const wbotMonitor = async (
  wbot: any,
  whatsapp: any
): Promise<void> => {
  logger.warn("Legacy wbotMonitor called. This should not happen.");
};

export default wbotMonitor;
