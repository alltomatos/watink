import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require("pdf-parse");

class PdfService {
    async parsePdf(filePath: string): Promise<string> {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error("File not found");
            }

            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);

            // Clean up whitespace
            return data.text.replace(/\s+/g, " ").trim();
        } catch (error) {
            console.error("PDF Parsing error:", error);
            throw new Error(`Failed to parse PDF: ${error.message}`);
        }
    }
}

export default new PdfService();
