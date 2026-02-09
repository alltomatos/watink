
import { startDatabase } from "../src/database";
import Whatsapp from "../src/models/Whatsapp";
import { StartWhatsAppSession } from "../src/services/WbotServices/StartWhatsAppSession";
import RabbitMQService from "../src/services/RabbitMQService";
import { RedisService } from "../src/services/RedisService";
import { initIO } from "../src/libs/socket";

const run = async () => {
    try {
        console.log("Initializing database...");
        await startDatabase();

        console.log("Initializing Redis...");
        RedisService.getInstance();

        console.log("Initializing RabbitMQ...");
        await RabbitMQService.connect();

        console.log("Initializing Socket Mock...");
        // Mock IO since we don't have a server
        // We might need to mock getIO if it throws
        try {
            const http = require('http');
            const server = http.createServer();
            initIO(server);
        } catch (e) {
            console.warn("Socket init warn", e);
        }

        console.log("Fetching Whatsapp ID 3...");
        const whatsapp = await Whatsapp.findByPk(3);

        if (!whatsapp) {
            console.error("Whatsapp ID 3 not found!");
            process.exit(1);
        }

        console.log("Found Whatsapp:", whatsapp.name, "Engine:", whatsapp.engineType);

        console.log("Calling StartWhatsAppSession...");
        await StartWhatsAppSession(whatsapp, false, undefined, true);

        console.log("Success! No error thrown.");

    } catch (error) {
        console.error("CAUGHT ERROR:", error);
    } finally {
        process.exit(0);
    }
};

run();
