import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { z } from "zod";
import { SCRAPING_PROMPT, SCRAPING_SYSTEM_PROMPT } from "./ai/prompts/scraping";

dotenv.config();

async function testPrompt(htmlPath: string, scrapingSchema: string) {
  try {
    const cleanedHtml = readFileSync(htmlPath, "utf-8");
    console.log("🔍 Testing prompt with schema:", scrapingSchema);

    console.log("\n🔍 Extracting data from relevant sections...");
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: SCRAPING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: SCRAPING_PROMPT(cleanedHtml, scrapingSchema),
        },
      ],
      schema: z.object({
        data: z
          .any()
          .optional()
          .describe(
            "The data object containing extracted items. Items array should be nested under this."
          ),
        hasError: z
          .boolean()
          .optional()
          .describe(
            "Boolean flag indicating if any errors occurred during extraction"
          ),
        errorMessage: z
          .string()
          .optional()
          .describe(
            "Detailed error message if hasError is true, explaining what went wrong"
          ),
        hasMoreData: z
          .boolean()
          .optional()
          .describe(
            "Boolean flag indicating if there are more pages/items to be loaded, doesn't mean there is more data in the current page"
          ),
        nextCursorUrl: z
          .string()
          .optional()
          .describe(
            "URL or cursor value for fetching the next page of results when hasMoreData is true"
          ),
      }),
      maxRetries: 0,
    });

    console.log("\n📊 Result:", JSON.stringify(result.object, null, 2));

    const data = result.object.data;
    if (Array.isArray(data)) {
      console.log(`🔢 Data length: ${data.length}`);
    } else if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          console.log(`🔢 ${key} length: ${value.length}`);
        }
      });
    }

    // Log the costs and tokens usage
    console.log("🔍 Scraping tokens:", result.usage.totalTokens);
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

testPrompt(
  "./cleaned-html.html",
  `
    reviews[] = {
      title: string
      rating: number
      date: string
      text: string
      author: string
    }
  `
);

// testPrompt(
//   "./thefork.html",
//   `
//     restaurants[] = {
//       name: string
//       address: string
//       rating: number
//       reviewsCount: number
//       price: number
//       discount: number
//       description: string
//     }
//   `
// );
