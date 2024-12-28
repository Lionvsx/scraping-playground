import { generateObject } from "ai";
import dotenv from "dotenv";
import { chromium } from "playwright-extra";
import { z } from "zod";
import {
  SCRAPING_PROMPT,
  SCRAPING_SYSTEM_PROMPT,
} from "../ai/prompts/scraping";
import { createBrowserSession } from "./browser/create-session";
import { cleanupHtml } from "./cleanup-html";
import { simulateHumanScrolling } from "./simulate-human-behavior";

import { anthropic } from "@ai-sdk/anthropic";

dotenv.config();

const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

type ScrapeOptions = {
  url: string;
  scrapingSchema: string;
};

type ScrapingSuccessOutput = {
  data: any;
  hasError: false;
  hasMoreData?: boolean;
  nextCursorUrl?: string;
};

type ScrapingErrorOutput = {
  hasError: true;
  errorMessage: string;
};

type ScrapingOutput = ScrapingSuccessOutput | ScrapingErrorOutput;

export async function scrape({
  url,
  scrapingSchema,
}: ScrapeOptions): Promise<ScrapingOutput> {
  console.log("Starting browser...");

  const session = await createBrowserSession();
  const browser = await chromium.connectOverCDP(session.connectUrl);

  try {
    const page = await browser.newPage();

    await page.goto(url);

    // Execute the scrolling behavior
    await simulateHumanScrolling(page);

    // Clean up the page content
    const pageContent = await page.content();
    const cleanedHtml = cleanupHtml(pageContent);
    await page.setContent(cleanedHtml);
    console.log(cleanedHtml);
    console.log("Page content cleaned");

    await browser.close();

    console.log(`🔍 Processing ${url} with schema: ${scrapingSchema}`);

    const result = await generateObject({
      model: anthropic("claude-3-5-haiku-latest"),
      system: SCRAPING_SYSTEM_PROMPT,
      prompt: SCRAPING_PROMPT(cleanedHtml),
      schemaDescription: `Thoroughly extract ALL data from the page that matches the schema: ${scrapingSchema}. Do not skip any matching content. If pagination is present, indicate it in hasMoreData and nextCursorUrl fields. Ensure complete coverage of the page content.`,
      schemaName: "scraping-result",
      schema: z.object({
        data: z
          .any()
          .optional()
          .describe("The data extracted from the page")
          .refine((data) => data !== undefined, {
            message: "Data is required when hasError is false",
            path: ["data"],
          }),
        hasError: z
          .boolean()
          .describe(
            "Whether there was an error during the extraction, example, we have bean blocked by the website"
          ),
        errorMessage: z
          .string()
          .optional()
          .describe("The error message if there was an error"),
        hasMoreData: z
          .boolean()
          .optional()
          .describe("Whether there is more data to extract"),
        nextCursorUrl: z
          .string()
          .optional()
          .describe("The URL to navigate to if there is more data to extract"),
      }),
      maxRetries: 3,
    });

    let allData: any[] = [];
    let hasPagination = false;
    let nextPageUrl: string | undefined;

    if (!result.object.hasError && result.object.data) {
      const newData = Array.isArray(result.object.data)
        ? result.object.data
        : [result.object.data];
      console.log(`✅ Extracted ${newData.length} items`);
      allData = newData;

      if (result.object.hasMoreData && result.object.nextCursorUrl) {
        hasPagination = true;
        nextPageUrl = new URL(result.object.nextCursorUrl, url).toString();
        console.log(`📑 Found pagination, next page: ${nextPageUrl}`);
      }
    } else if (result.object.hasError) {
      console.error(`❌ Error:`, result.object.errorMessage);
    }

    console.log(
      `\n🎯 Completed extraction: ${allData.length} total items found`
    );
    if (hasPagination) {
      console.log(`📚 More pages available at: ${nextPageUrl}`);
    }

    return {
      data: allData,
      hasError: false,
      hasMoreData: hasPagination,
      nextCursorUrl: nextPageUrl,
    };
  } catch (error) {
    console.error("❌ Scraping failed:", error);
    throw error;
  }
}
