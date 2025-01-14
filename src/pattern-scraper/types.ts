import { z } from "zod";

//--------------------------------------------------------------------------------------
// Types
//--------------------------------------------------------------------------------------

export const ScrapingInstructionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    fieldName: z.string(),
    selector: z.string(),
    attribute: z.string().optional(),
    type: z.enum(["string", "number", "date"]).optional(),
    isList: z.boolean().optional(),
    childInstructions: z.array(ScrapingInstructionSchema).optional(), // recursion
  })
);

export const ScrapingPatternSchema = z.object({
  name: z.string().describe("The name of the pattern"),
  description: z
    .string()
    .describe(
      "What the pattern is used for, e.g. 'scrape reviews from a restaurant'. This is used to help the AI understand the pattern and when to use it."
    ),
  instructions: z.array(ScrapingInstructionSchema),
});

export const ValidationSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.string()),
});

// We can define TypeScript types from these schemas
export type ScrapingInstruction = z.infer<typeof ScrapingInstructionSchema>;
export type ScrapingPattern = z.infer<typeof ScrapingPatternSchema>;

export interface ScrapingResult<T = any> {
  data?: T;
  error?: string;
}

export type ValidationResult = z.infer<typeof ValidationSchema>;
