import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { readFileSync } from "fs";
import { z } from "zod";
import { SCRAPING_PROMPT, SCRAPING_SYSTEM_PROMPT } from "./ai/prompts/scraping";
import dotenv from "dotenv";
import { openai } from "@ai-sdk/openai";

dotenv.config();

async function extractReviews(htmlContent: string) {
  console.log("Processing local HTML file...");

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    system: SCRAPING_SYSTEM_PROMPT,
    prompt: SCRAPING_PROMPT(htmlContent),
    schemaDescription: `
    Thoroughly extract ALL reviews from the content that matches the schema:
    reviews[] = {
      title: string
      rating: number
      date: string
      text: string
      author: string
    }
    Do not skip any matching content.`,
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

  if (!result.object.hasError && result.object.data) {
    const reviews = Array.isArray(result.object.data)
      ? result.object.data
      : [result.object.data];
    console.log(`✅ Extracted ${reviews.length} reviews`);
    return reviews;
  } else {
    console.error("❌ Error:", result.object.errorMessage);
    throw new Error(result.object.errorMessage);
  }
}

// Main execution
(async () => {
  try {
    const htmlContent = readFileSync("tripadvisor-jina.txt", "utf-8");
    const reviews = await extractReviews(htmlContent);
    console.log(JSON.stringify(reviews, null, 2));
  } catch (error) {
    console.error("Failed to process reviews:", error);
  }
})();
