import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

const EnrichContactService = async (
  contact: Contact,
  whatsapp: Whatsapp
): Promise<Contact> => {
  logger.warn("EnrichContactService: Legacy wbot enrichment disabled.");
  return contact;
};

export default EnrichContactService;
