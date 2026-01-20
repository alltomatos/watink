import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

class ScraperService {
    async scrape(url: string): Promise<string> {
        try {
            // 1. Try Simple Fetch first (faster)
            // const response = await fetch(url);
            // const html = await response.text();
            // const $ = cheerio.load(html);
            // // Remove scripts, styles
            // $("script").remove();
            // $("style").remove();
            // return $("body").text().replace(/\s+/g, " ").trim();

            // 2. Use Puppeteer for better compatibility (SPA, JS render)
            const browser = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
                ],
                headless: true
            });

            const page = await browser.newPage();

            // Set a reasonable timeout
            await page.setDefaultNavigationTimeout(30000); // 30s

            await page.goto(url, { waitUntil: "networkidle2" });

            // Extract text from body
            const content = await page.evaluate(() => {
                // Remove script and style elements
                const scripts = document.querySelectorAll("script, style");
                scripts.forEach((script) => script.remove());

                // Get text content
                return document.body.innerText;
            });

            await browser.close();

            // Clean up whitespace
            return content.replace(/\s+/g, " ").trim();

        } catch (error) {
            console.error("Scraping error:", error);
            throw new Error(`Failed to scrape URL: ${error.message}`);
        }
    }
}

export default new ScraperService();
