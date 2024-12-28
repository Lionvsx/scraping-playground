import * as cheerio from "cheerio";

export function splitHtmlIntoChunks(
  html: string,
  maxChunkSize: number = 24000
): string[] {
  const $ = cheerio.load(html);
  const chunks: string[] = [];

  // More specific and broader container selectors
  const containers = $(
    // Primary containers that usually hold multiple items
    "section, .container, [data-items-container], .products-grid, .reviews-list," +
      // Common list/grid patterns
      'ul.items, div[class*="list"], div[class*="grid"],' +
      // Individual items as fallback
      "article, .product, .review, .card"
  );

  if (containers.length > 0) {
    console.log(`📦 Found ${containers.length} content containers`);
    let currentChunk = "";

    containers.each((_, element) => {
      const elementHtml = $(element).toString();

      if (currentChunk.length + elementHtml.length > maxChunkSize) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = elementHtml;
      } else {
        currentChunk += elementHtml;
      }
    });

    if (currentChunk) chunks.push(currentChunk);
  } else {
    // Fallback with larger chunks
    console.log("⚠️ No containers found, using fallback splitting");
    let currentChunk = "";
    $("body > *").each((_, element) => {
      const elementHtml = $(element).toString();

      if (currentChunk.length + elementHtml.length > maxChunkSize) {
        chunks.push(currentChunk);
        currentChunk = elementHtml;
      } else {
        currentChunk += elementHtml;
      }
    });

    if (currentChunk) chunks.push(currentChunk);
  }

  console.log(`📊 Created ${chunks.length} chunks`);
  return chunks;
}
