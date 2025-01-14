import * as cheerio from "cheerio";
import {
  ScrapingInstruction,
  ScrapingPattern,
  ScrapingResult,
  ValidationResult,
} from "./types";
import { AIValidationAgent } from "./ai-validation-agent";

export class ScrapingService {
  constructor() {}

  /**
   * Main entry: scrape data from the entire HTML using the top-level pattern instructions
   */
  public scrapeWithPattern(
    html: string,
    pattern: ScrapingPattern
  ): ScrapingResult {
    try {
      const $ = cheerio.load(html);

      // We'll build a single object that includes all top-level fields. Some fields can be arrays or single values.
      const data: any = {};

      // For each top-level instruction, we either do direct scraping or, if it has childInstructions, we do nested scraping.
      for (const instr of pattern.instructions) {
        // For top-level instructions, we apply them to the entire doc (i.e. root).
        data[instr.fieldName] = this.applyInstruction($, $.root(), instr);
      }

      // If you want the final data to be an array, you can do something else here.
      // But let's just return data as an object, or flatten it if you prefer.
      return { data };
    } catch (error: any) {
      return { error: `Scraping error: ${error.message}` };
    }
  }

  /**
   * applyInstruction is a recursive function:
   * - If isList is true, we find all elements matching "selector"
   * - If childInstructions exist, we further scrape within each element
   * - Otherwise we just parse text/attribute
   */
  private applyInstruction(
    $: cheerio.CheerioAPI,
    scope: cheerio.Cheerio<any>,
    instr: ScrapingInstruction
  ): any {
    // If it's a list, we gather multiple items
    if (instr.isList) {
      const elements = scope.find(instr.selector).toArray();
      // For each element, we either gather sub-fields from childInstructions or parse text
      return elements.map((el) => {
        const $el = $(el);

        if (instr.childInstructions && instr.childInstructions.length > 0) {
          // We have nested instructions
          const nestedData: any = {};
          for (const child of instr.childInstructions) {
            nestedData[child.fieldName] = this.applyInstruction($, $el, child);
          }
          return nestedData;
        } else {
          // No child instructions => parse a direct value
          return this.parseValue(
            this.getRawValue($el, instr.attribute),
            instr.type
          );
        }
      });
    } else {
      // Not a list => take the first match
      const $el = scope.find(instr.selector).first();
      if (!$el.length) {
        return null;
      }
      // If we have child instructions, gather them
      if (instr.childInstructions && instr.childInstructions.length > 0) {
        const nestedData: any = {};
        for (const child of instr.childInstructions) {
          nestedData[child.fieldName] = this.applyInstruction($, $el, child);
        }
        return nestedData;
      } else {
        // Just parse single value
        return this.parseValue(
          this.getRawValue($el, instr.attribute),
          instr.type
        );
      }
    }
  }

  /**
   * Helper: retrieve raw text or attribute from a cheerio element
   */
  private getRawValue($el: cheerio.Cheerio<any>, attribute?: string): string {
    if (attribute) {
      return $el.attr(attribute) || "";
    } else {
      return $el.text() || "";
    }
  }

  /**
   * Helper: parse & sanitize
   */
  private parseValue(raw: string, type?: "string" | "number" | "date"): any {
    if (!raw) return "";

    // Normalize whitespace
    let val = raw.replace(/\s+/g, " ").trim();

    if (type === "number") {
      // remove all non-numeric except commas/dots/possible minus sign
      val = val.replace(/[^\d.,-]/g, "");
      // swap commas for dots
      val = val.replace(",", ".");
      const floatVal = parseFloat(val);
      return isNaN(floatVal) ? "" : floatVal;
    } else if (type === "date") {
      const dateVal = new Date(val);
      // If invalid, return raw
      if (isNaN(dateVal.getTime())) {
        return val;
      }
      return dateVal.toISOString();
    }
    return val;
  }

  /**
   * Validates scraped results against the original schema using AI
   * Can optionally sanitize the data if validation fails
   */
  public async validateResults(
    scrapedData: any,
    originalSchema: string,
    shouldSanitize: boolean = true
  ): Promise<ValidationResult & { sanitizedData?: any }> {
    const validationAgent = new AIValidationAgent();
    return validationAgent.validateAndSanitize(
      scrapedData,
      originalSchema,
      shouldSanitize,
      1
    );
  }
}
