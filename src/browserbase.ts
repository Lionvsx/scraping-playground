import { chromium } from "playwright-core";
import { createBrowserSession } from "./functions/browser/create-session";

(async () => {
  // Create a new session
  const session = await createBrowserSession();

  // Connect to the session
  const browser = await chromium.connectOverCDP(session.connectUrl);

  // Getting the default context to ensure the sessions are recorded.
  const defaultContext = browser.contexts()[0];
  const page = defaultContext?.pages()[0];

  await page?.goto("https://www.tripadvisor.fr/TripDetails-t115791528", {
    waitUntil: "networkidle",
  });

  await page?.close();
  await browser.close();
  console.log(
    `Session complete! View replay at https://browserbase.com/sessions/${session.id}`
  );
})().catch((error) => console.error(error.message));
