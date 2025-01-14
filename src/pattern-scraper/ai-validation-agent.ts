import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { ValidationResult } from "./types";

interface SanitizationResult {
  sanitizedData?: any;
  changes: string[];
}

export class AIValidationAgent {
  /**
   * Validates and optionally sanitizes scraped data against a schema
   */
  public async validateAndSanitize(
    scrapedData: any,
    originalSchema: string,
    shouldSanitize: boolean = true,
    maxAttempts: number = 3
  ): Promise<ValidationResult & { sanitizedData?: any }> {
    // First, validate the data structure
    let validationResult = await this.validateStructure(
      scrapedData,
      originalSchema
    );

    console.log("Validation result:", validationResult);

    // If validation failed and sanitization is requested, try to fix the data
    let attempts = 0;

    while (
      !validationResult.isValid &&
      shouldSanitize &&
      attempts < maxAttempts
    ) {
      console.log("Sanitizing data...");
      const sanitizationResult = await this.sanitizeData(
        scrapedData,
        originalSchema,
        validationResult.issues
      );

      // Validate the sanitized data again
      validationResult = await this.validateStructure(
        sanitizationResult.sanitizedData,
        originalSchema
      );

      if (validationResult.isValid) {
        return {
          isValid: true,
          issues: [],
          sanitizedData: sanitizationResult.sanitizedData,
        };
      }

      attempts++;
      scrapedData = sanitizationResult.sanitizedData;
    }

    return validationResult;
  }

  /**
   * Validates the structure and content of scraped data
   */
  private async validateStructure(
    scrapedData: any,
    originalSchema: string
  ): Promise<ValidationResult> {
    const systemPrompt = `
You are a data validation expert. Your task is to verify if scraped data matches the expected schema.
Analyze the data structure and content quality.

Return a JSON response in this format:
{
  "isValid": boolean,
  "issues": string[],
  "summary": "brief explanation of validation results"
}

Check for:
1. Structural compliance with schema
2. Data quality (empty fields, malformed data)
3. Expected data types
4. Reasonable content (e.g., dates should look like dates)
5. Format consistency across similar fields
`;

    const userPrompt = `
Original Schema:
${originalSchema}

Scraped Data:
${JSON.stringify(scrapedData, null, 2)}

Validate if the data matches the schema and provide detailed feedback.
List any formatting inconsistencies or data quality issues.
`;

    try {
      const response = await generateObject({
        model: openai("gpt-4o-mini"),
        system: systemPrompt,
        prompt: userPrompt,
        schema: z.object({
          isValid: z.boolean(),
          issues: z.array(z.string()),
        }),
        maxRetries: 1,
      });

      return response.object;
    } catch (err: any) {
      return {
        isValid: false,
        issues: [`Validation failed: ${err.message}`],
      };
    }
  }

  /**
   * Attempts to sanitize data based on validation issues
   */
  private async sanitizeData(
    data: any,
    schema: string,
    issues: string[]
  ): Promise<SanitizationResult> {
    const systemPrompt = `
You are a data sanitization expert. Your task is to fix data quality and formatting issues in the provided data.
The data should conform to the given schema and maintain consistency across similar fields.

Return a JSON response in this format:
{
  "sanitizedData": object (the fixed data),
  "changes": string[] (list of changes made)
}

Focus on:
1. Fixing data type mismatches
2. Standardizing date formats
3. Cleaning text fields (removing extra whitespace, fixing encoding)
4. Ensuring numeric fields are properly formatted
5. Maintaining consistency in formatting across similar fields
`;

    const userPrompt = `
Original Schema:
${schema}

Original Data:
${JSON.stringify(data, null, 2)}

Validation Issues to Fix:
${issues.join("\n")}

Please sanitize the data and list all changes made.
`;

    try {
      const response = await generateObject({
        model: openai("gpt-4o-mini"),
        system: systemPrompt,
        prompt: userPrompt,
        schema: z.object({
          sanitizedData: z.any(),
          changes: z.array(z.string()),
        }),
        maxRetries: 2,
      });

      return response.object;
    } catch (err: any) {
      return {
        sanitizedData: data,
        changes: [`Failed to sanitize: ${err.message}`],
      };
    }
  }
}
