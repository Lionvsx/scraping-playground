import dotenv from "dotenv";
import { chromium } from "playwright-core";

dotenv.config();
const connectionURL = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`;

async function setupBrowser() {
  const browser = await chromium.connectOverCDP(connectionURL);

  // Getting the default context to ensure the sessions are recorded.
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  return { browser, page };
}

async function scrapeWithRetry(url: string, maxRetries = 3) {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const { browser, page } = await setupBrowser();

      // Add random delay before navigation
      await page.waitForTimeout(2000 + Math.random() * 3000);

      const response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Check if we got blocked
      const content = await page.content();
      if (
        content.includes("captcha-delivery") ||
        content.includes("Please enable JS") ||
        content.includes("datadome")
      ) {
        console.log(`Blocked on attempt ${retryCount + 1}, retrying...`);
        await browser.close();
        retryCount++;
        // Add exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
        continue;
      }

      // Your content extraction code here
      const $ = require("cheerio").load(content);
      // ... rest of your scraping logic

      await browser.close();
      return content;
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts`);
      }
    }
  }
}

// Usage
(async () => {
  try {
    const content = await scrapeWithRetry(
      "https://www.tripadvisor.fr/TripDetails-t115791528"
    );
    console.log(content);
    console.log("Successfully scraped content");
  } catch (error) {
    console.error("Final error:", error);
    process.exit(1);
  }
})();
