import axios from "axios";
import fs from "fs";
import path, { join } from "path";
import uploadConfig from "../config/upload";
import { logger } from "../utils/logger";
// import sharp from "sharp";

interface Request {
    profilePicUrl: string;
    tenantId: number | string;
    contactId: number;
}

export const DownloadProfileImage = async ({
    profilePicUrl,
    tenantId,
    contactId
}: Request): Promise<string> => {
    const publicFolder = uploadConfig.directory;
    let filename = "";

    const folder = path.join(publicFolder, String(tenantId), "contacts");

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
    }

    // If already local or special placeholder, return empty
    if (!profilePicUrl || profilePicUrl.includes("/public/") || profilePicUrl.endsWith("nopicture.png")) {
        return "";
    }

    // Filename pattern: ${contact_id}_profile.jpg
    filename = `${contactId}_profile.jpg`;
    const filePath = join(folder, filename);

    const maxAttempts = 3;
    let attempt = 0;

    logger.info(`[DownloadProfileImage] Downloading new image for contact ${contactId}...`);

    while (attempt < maxAttempts) {
        try {
            const response = await axios.get(profilePicUrl, {
                responseType: "arraybuffer",
                timeout: 10000
            });

            // Process image with sharp if available, else save directly
            try {
                const sharp = require("sharp");
                await sharp(response.data)
                    .resize(500, 500, {
                        fit: 'inside', // Maintain aspect ratio, max 500x500
                        withoutEnlargement: true // Don't upscale if smaller
                    })
                    .jpeg({
                        quality: 80,
                        mozjpeg: true
                    })
                    .toFile(filePath);
            } catch (err) {
                if (err.code === 'MODULE_NOT_FOUND') {
                    logger.warn(`[DownloadProfileImage] Sharp module not found. Saving image directly without processing.`);
                    fs.writeFileSync(filePath, response.data);
                } else {
                     throw err;
                }
            }

            logger.info(`[DownloadProfileImage] Successfully downloaded and processed image for contact ${contactId} to ${filename}`);
            return filename;
        } catch (error) {
            logger.error(`[DownloadProfileImage] Failed attempt ${attempt + 1} for contact ${contactId}: ${error}`);
            attempt++;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return "";
};
