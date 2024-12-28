export const PATTERN_SYSTEM_PROMPT = `You are an expert web scraping assistant that generates precise CSS selectors and scraping instructions.
Your task is to analyze HTML content and a given schema, then produce exact CSS selectors and instructions for extracting the required data.

Rules:
1. Always prefer CSS selectors over XPath
2. Make selectors as specific as possible while remaining robust
3. Include data transformation instructions when needed
4. Consider the structure of repeating elements
5. CAREFULLY analyze the provided HTML to find the actual selectors that exist
6. Test each selector mentally to ensure it will match the desired elements
7. For numeric values, ensure proper transformation (parseFloat, parseInt)`;

export const buildPatternPrompt = (
  htmlContent: string,
  scrapingSchema: string
): string => {
  return `Given this schema:
\`\`\`
${scrapingSchema}
\`\`\`

And this HTML sample:
\`\`\`html
${htmlContent.slice(0, 2000)}...
\`\`\`

IMPORTANT: First analyze the HTML structure to identify the actual selectors present in the HTML.
Look for class names, IDs, or data attributes that uniquely identify the elements we need.

Then generate precise CSS selectors and instructions to extract the data according to the schema.
Make sure each selector actually exists in the HTML sample.

Return a JSON object with:
1. A container selector that matches the repeating element for each item
2. Specific selectors for each field that exist in the HTML
3. The type of extraction (text, attribute, exists)
4. Any necessary transformations for numeric values

Example response format:
{
  "containerSelector": ".restaurant-card",  // Must exist in HTML
  "fields": {
    "name": {
      "selector": "h3.name",  // Must exist in HTML
      "type": "text",
      "required": true
    },
    "rating": {
      "selector": "[data-rating]",  // Must exist in HTML
      "type": "attribute",
      "attribute": "data-rating",
      "transform": "parseFloat",
      "required": true
    }
  },
  "isArray": true
}

Before returning the response, verify that:
1. The container selector matches multiple elements in the HTML
2. Each field selector exists within the container element
3. Numeric fields have appropriate transformations`;
};
