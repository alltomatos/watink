import * as Sentry from "@sentry/node";
import { logger } from "../../utils/logger";

export const wbotMessageListener = async (wbot: any): Promise<void> => {
  logger.warn("Legacy wbotMessageListener called. This should not happen in Microservices mode.");
};

export const handleMessage = async (msg: any, wbot: any): Promise<void> => {
   logger.warn("Legacy handleMessage called.");
};
