import { logger } from "../../utils/logger";

const ImportContactsService = async (userId: number): Promise<void> => {
  logger.warn("ImportContactsService is disabled in Microservices mode.");
};

export default ImportContactsService;
