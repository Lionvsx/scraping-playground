import { config } from "dotenv";
import { readFileSync } from "fs";
import { ScrapingService } from "./scraping-service";
import { createScrapingPattern } from "./ai-scraping-agent";

// Initialize env vars (OPENAI_API_KEY, etc.)
config();

// Export all the components
export * from "./types";
export * from "./ai-scraping-agent";
export * from "./scraping-service";

//--------------------------------------------------------------------------------------
// Example usage in a "main" function
//--------------------------------------------------------------------------------------

async function main() {
  try {
    // 1) Load HTML. Suppose "page.html" is a TripAdvisor-like page with reviews, etc.
    const htmlContent = readFileSync("cleaned-html.html", "utf-8");

    // 2) The schema referencing nested fields. For example:
    //    - top-level "placeName: string"
    //    - "reviews" is a list with child instructions for username, title, etc.
    const schema = `
    reviews[] = {
      username: string
      rating: number
      title: string
      dateOfVisit: string
      text: string
      datePosted: string
    }
    `;

    // 3) Create the AI agent + request nested instructions
    console.log("Requesting scraping pattern from AI Agent...");
    const pattern = await createScrapingPattern(htmlContent, schema);
    console.log("Got pattern:", JSON.stringify(pattern, null, 2));

    // 4) Scrape according to that nested pattern
    console.log("Scraping with nested instructions...");
    const scrapingService = new ScrapingService();
    const result = scrapingService.scrapeWithPattern(htmlContent, pattern);

    if (result.error) {
      console.error("Error scraping:", result.error);
    } else {
      console.log("Scraped data:", JSON.stringify(result.data, null, 2));

      // Validate the results with sanitization enabled
      console.log("Validating and sanitizing results...");
      const validation = await scrapingService.validateResults(
        result.data,
        schema,
        true
      );

      console.log("\nValidation Results:");
      console.log("-------------------");
      console.log(`Valid: ${validation.isValid}`);

      if (validation.sanitizedData) {
        console.log("\nData was sanitized!");
        console.log(
          "Sanitized data:",
          JSON.stringify(validation.sanitizedData, null, 2)
        );
      }

      if (validation.issues.length > 0) {
        console.log("\nIssues Found:");
        validation.issues.forEach((issue) => console.log(`- ${issue}`));
      }
    }
  } catch (error) {
    console.error("❌ Error in main:", error);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}
