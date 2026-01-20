
import { Envelope } from "../../microservice/contracts";
import RabbitMQService from "../RabbitMQService";
import { logger } from "../../utils/logger";

interface ContactSyncPayload {
    contactId: number;
}

export const CommandListener = async () => {
    // Backend should NOT listen to contact.sync commands intended for the Engine
    const routingKeys: string[] = [];

    // Se houver outros comandos que o Backend deva processar, adicione aqui.
    // Por enquanto, contact.sync é processado apenas pelo Engine.
    
    if (routingKeys.length > 0) {
        await RabbitMQService.consumeCommands("api.commands.process", routingKeys, async (msg: Envelope) => {
            logger.info(`Command received: ${msg.type}`);

            switch (msg.type) {
                // case "some.other.command":
                //     await handleSomething(msg.payload);
                //     break;
                default:
                    logger.warn(`Unknown command type: ${msg.type}`);
            }
        });
    }
};
