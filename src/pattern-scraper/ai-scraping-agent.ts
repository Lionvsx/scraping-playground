import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ScrapingPattern, ScrapingPatternSchema } from "./types";

/**
 * 1) We prompt the AI model to generate a JSON describing how to find fields, with CSS selectors.
 * 2) We parse that JSON and return it as `ScrapingPattern`.
 */
export async function createScrapingPattern(
  html: string,
  schema: string
): Promise<ScrapingPattern> {
  const systemPrompt = `
You are a highly skilled AI that generates instructions to scrape data from HTML pages.
You can produce nested instructions with childInstructions if, for instance,
the user wants to scrape a list of sub-objects (e.g. reviews).

Output valid JSON with this structure:

{
  "name": "...",
  "instructions": [
    {
      "fieldName": "...",
      "selector": "...",
      "attribute": "...",
      "type": "string|number|date",
      "isList": boolean,
      "childInstructions": [ ... ] (optional, for nested fields)
    },
    ...
  ]
}

No code fences, no extra text, just valid JSON that can be parsed directly.
`;

  const userPrompt = `
--- HTML START ---
${html}
--- HTML END ---

--- SCHEMA ---
${schema}

Please produce the scraping JSON pattern now.
`;
  try {
    // We'll parse the AI model's response into the nested structure using zod
    const response = await generateObject({
      model: anthropic("claude-3-5-sonnet-20240620"),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ScrapingPatternSchema,
      maxRetries: 2,
    });

    // Return the validated object
    return response.object;
  } catch (err: any) {
    throw new Error(`createScrapingPattern error: ${err.message}`);
  }
}
