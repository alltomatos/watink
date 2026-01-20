import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";

export const GetWbotMessage = async (
  ticket: Ticket,
  messageId: string
): Promise<any> => {
  throw new AppError("Legacy GetWbotMessage is disabled. Use Microservices/RabbitMQ.");
};

export default GetWbotMessage;
