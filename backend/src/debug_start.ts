
import sequelize from "./database";
import Whatsapp from "./models/Whatsapp";
import { StartWhatsAppSession } from "./services/WbotServices/StartWhatsAppSession";
import RabbitMQService from "./services/RabbitMQService";
import { RedisService } from "./services/RedisService";
import { initIO } from "./libs/socket";

const run = async () => {
    try {
        console.log("Initializing database...");
        await sequelize.authenticate();

        console.log("Initializing Redis...");
        RedisService.getInstance();

        console.log("Initializing RabbitMQ...");
        await RabbitMQService.connect();

        console.log("Initializing Socket Mock...");
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
        if (error instanceof Error) {
            console.error("STACK:", error.stack);
        }
    } finally {
        process.exit(0);
    }
};

run();
