import Browserbase from "@browserbasehq/sdk";
import dotenv from "dotenv";

dotenv.config();

const BROWSERBASE_API_KEY = process.env["BROWSERBASE_API_KEY"]!;
const BROWSERBASE_PROJECT_ID = process.env["BROWSERBASE_PROJECT_ID"]!;

const bb = new Browserbase({
  apiKey: BROWSERBASE_API_KEY,
});

export async function createBrowserSession() {
  const session = await bb.sessions.create({
    projectId: BROWSERBASE_PROJECT_ID,
    browserSettings: {
      solveCaptchas: true,
    },
    proxies: [
      {
        type: "browserbase",
        geolocation: {
          city: "Paris",
          country: "FR",
        },
      },
    ],
  });

  return session;
}
