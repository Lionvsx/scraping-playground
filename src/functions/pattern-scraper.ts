import { Redis } from "@upstash/redis";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { load, type Cheerio } from "cheerio";
import crypto from "crypto";
import dotenv from "dotenv";
import { z } from "zod";
import {
  PATTERN_SYSTEM_PROMPT,
  buildPatternPrompt,
} from "../ai/prompts/scraping-pattern";
import {
  ScrapingInstruction,
  ScrapingInstructions,
  ScrapingPattern,
} from "../types/scraping";

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function generatePatternHash(schema: string): string {
  return crypto.createHash("md5").update(schema).digest("hex");
}

function analyzeHtmlStructure(htmlContent: string): string {
  const $ = load(htmlContent);
  const analysis: string[] = [];

  // Find restaurant links and their containers
  const restaurantLinks = $("a[href*='/restaurant/']");
  if (restaurantLinks.length > 0) {
    // Get the first restaurant for detailed analysis
    const firstRestaurant = restaurantLinks.first();
    let current = firstRestaurant;
    let level = 0;

    // Walk up 5 levels to understand structure
    while (level < 5 && current.length) {
      const classes = current.attr("class");
      const dataAttrs = Object.keys(current.data()).join(", ");
      const text = current.text().trim();

      // Look for specific data patterns
      const priceMatch = text.match(/Prix moyen\s*(\d+)\s*€/);
      const discountMatch = text.match(/-(\d+)%\s*sur la carte/);
      const addressMatch = text.match(
        /\d+\s+(?:rue|boulevard|avenue)[^,]+,\s*\d{5}/i
      );

      analysis.push(`Level ${level}:`);
      analysis.push(`HTML: ${current.prop("outerHTML")}`);
      if (classes) analysis.push(`Classes: ${classes}`);
      if (dataAttrs) analysis.push(`Data attributes: ${dataAttrs}`);
      analysis.push(`Text content: ${text}`);
      if (priceMatch) analysis.push(`Found price: ${priceMatch[1]}€`);
      if (discountMatch) analysis.push(`Found discount: ${discountMatch[1]}%`);
      if (addressMatch) analysis.push(`Found address: ${addressMatch[0]}`);
      analysis.push("");

      current = current.parent();
      level++;
    }
  }

  return analysis.join("\n");
}

export async function getScrapingPattern(
  schemaName: string,
  htmlContent: string,
  scrapingSchema: string
): Promise<ScrapingPattern> {
  const patternHash = generatePatternHash(scrapingSchema);
  const cacheKey = `scrape-pattern:${schemaName}:${patternHash}`;

  const cachedPattern: ScrapingPattern | null = await redis.get(cacheKey);
  //   if (cachedPattern && cachedPattern.version === patternHash) {
  //     console.log(`Using cached pattern for schema: ${schemaName}`);
  //     return cachedPattern;
  //   }

  console.log(`Generating new pattern for schema: ${schemaName}...`);

  const htmlAnalysis = analyzeHtmlStructure(htmlContent);

  const result = await generateObject({
    model: openai("gpt-4o"),
    output: "no-schema",
    system: PATTERN_SYSTEM_PROMPT,
    prompt: `
Analyze this HTML structure to find restaurant data:

${htmlAnalysis}

Generate selectors for this schema:
${scrapingSchema}

The HTML contains restaurant data with these patterns:
1. Restaurant names are in <a> tags with href containing '/restaurant/'
2. Prices are in text matching "Prix moyen X €"
3. Discounts are in text matching "-X% sur la carte"
4. Addresses contain street numbers and names followed by postal code
5. Descriptions are usually after the price/discount information

Return this exact JSON structure:
{
  "containerSelector": "li",
  "fields": {
    "name": {
      "selector": "a[href*='/restaurant/']",
      "type": "text",
      "required": true
    },
    "address": {
      "selector": "li",
      "type": "text",
      "required": true
    },
    "rating": {
      "selector": "span[class*='rating'], span[class*='note']",
      "type": "text",
      "transform": "parseFloat",
      "required": false
    },
    "reviewsCount": {
      "selector": "span[class*='reviews'], span[class*='avis']",
      "type": "text",
      "transform": "parseInt",
      "required": false
    },
    "price": {
      "selector": "li",
      "type": "text",
      "transform": "parseFloat",
      "required": true
    },
    "discount": {
      "selector": "li",
      "type": "text",
      "transform": "parseFloat",
      "required": false
    },
    "description": {
      "selector": "li",
      "type": "text",
      "required": false
    }
  },
  "isArray": true
}`,
    temperature: 0.1,
  });

  try {
    const instructions = result.object;

    // Validate with Zod schema
    const instructionsSchema = z.object({
      containerSelector: z.string().optional(),
      fields: z.record(
        z.object({
          selector: z.string(),
          type: z.enum(["text", "attribute", "exists"]),
          attribute: z.string().optional(),
          transform: z.string().optional(),
          required: z.boolean().optional(),
        })
      ),
      isArray: z.boolean(),
    });

    const validatedInstructions = instructionsSchema.parse(instructions);

    const newPattern: ScrapingPattern = {
      version: patternHash,
      instructions: JSON.stringify(validatedInstructions),
      schema: scrapingSchema,
      lastUpdated: Date.now(),
    };

    await redis.set(cacheKey, newPattern);
    return newPattern;
  } catch (error) {
    console.error("Failed to parse or validate instructions:", error);
    throw error;
  }
}

function applyTransform(value: string, transform?: string): any {
  if (!transform) return value;

  switch (transform) {
    case "parseFloat":
      return parseFloat(value);
    case "parseInt":
      return parseInt(value, 10);
    case "boolean":
      return Boolean(value);
    default:
      return value;
  }
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\n/g, " ").trim();
}

function extractAddress(text: string): string {
  // Look for street address pattern
  const addressMatch = text.match(
    /\d+\s+(?:rue|boulevard|avenue|bd)[^,]+,\s*\d{5}\s*,?\s*paris/i
  );
  return addressMatch ? cleanText(addressMatch[0]) : "";
}

function extractDiscount(text: string): number | null {
  const match = text.match(/-(\d+)%\s*sur la carte/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractPrice(text: string): number | null {
  const match = text.match(/Prix moyen\s*(\d+)\s*€/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractDescription(text: string): string {
  // Look for text after price and discount that looks like a description
  const parts = text.split(/Prix moyen\s*\d+\s*€|-\d+%\s*sur la carte/i);
  if (parts.length > 1) {
    return cleanText(parts[parts.length - 1]);
  }
  return "";
}

function isValidRestaurantData(item: Record<string, any>): boolean {
  return (
    item.name?.length > 0 &&
    item.address?.length > 0 &&
    item.address.match(/\d+\s+(?:rue|boulevard|avenue|bd)[^,]+,\s*\d{5}/i) &&
    typeof item.price === "number" &&
    item.price > 0
  );
}

export function scrapeWithPattern(
  htmlContent: string,
  pattern: ScrapingPattern
): { data: any; error?: string } {
  try {
    const $ = load(htmlContent);
    const instructions: ScrapingInstructions = JSON.parse(pattern.instructions);

    const scrapeField = (
      el: Cheerio<any>,
      instruction: ScrapingInstruction
    ) => {
      let value: any;
      const rawText = el.text().trim();

      switch (instruction.type) {
        case "text": {
          const foundEl = el.find(instruction.selector);
          const text = foundEl.text().trim();

          // Field-specific handling
          switch (instruction.selector) {
            case "a[href*='/restaurant/']":
              value = cleanText(text.split(/\s*\n/)[0]); // Get first line only
              break;
            case "[data-test='restaurant-address']":
            case ".restaurant-address":
              value = extractAddress(text);
              break;
            case "[data-test='restaurant-price']":
            case ".restaurant-price":
              value = extractPrice(text);
              break;
            case "[data-test='restaurant-discount']":
            case ".restaurant-discount":
              value = extractDiscount(text);
              break;
            case "[data-test='restaurant-description']":
            case ".restaurant-description":
              value = extractDescription(text);
              break;
            default:
              value = cleanText(text);
          }
          break;
        }
        case "attribute":
          value = el
            .find(instruction.selector)
            .attr(instruction.attribute || "");
          break;
        case "exists":
          value = el.find(instruction.selector).length > 0;
          break;
        default:
          throw new Error(`Unknown instruction type: ${instruction.type}`);
      }

      if (instruction.transform && typeof value === "string") {
        value = applyTransform(value, instruction.transform);
      }

      return value;
    };

    if (instructions.isArray && instructions.containerSelector) {
      const items: any[] = [];
      const seenNames = new Set<string>();

      $(instructions.containerSelector).each((_, container) => {
        const $container = $(container);

        // Skip if this doesn't look like a restaurant container
        if (!$container.find("a[href*='/restaurant/']").length) {
          return;
        }

        const item: Record<string, any> = {};
        Object.entries(instructions.fields).forEach(
          ([field, fieldInstruction]) => {
            item[field] = scrapeField($container, fieldInstruction);
          }
        );

        // Clean and validate the data
        if (isValidRestaurantData(item) && !seenNames.has(item.name)) {
          seenNames.add(item.name);
          items.push(item);
        }
      });

      return { data: items };
    } else {
      const item: Record<string, any> = {};
      Object.entries(instructions.fields).forEach(
        ([field, fieldInstruction]) => {
          item[field] = scrapeField($("body"), fieldInstruction);
        }
      );
      return { data: isValidRestaurantData(item) ? item : null };
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
