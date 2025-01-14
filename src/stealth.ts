import { chromium } from "playwright-extra";

const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

// That's it, the rest is playwright usage as normal 😊
chromium.launch({ headless: true }).then(async (browser) => {
  const page = await browser.newPage();

  console.log("Testing the stealth plugin..");
  await page.goto("http://web.mta.info/developers/turnstile.html", {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: "stealth.png", fullPage: true });

  console.log("All done, check the screenshot. ✨");
  await browser.close();
});
