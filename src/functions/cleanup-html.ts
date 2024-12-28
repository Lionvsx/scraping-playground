import * as cheerio from "cheerio";

export function cleanupHtml(html: string): string {
  const $ = cheerio.load(html, {
    xml: false,
  });

  // Remove all hidden elements
  $(
    '[style*="display: none"], [style*="visibility: hidden"], [aria-hidden="true"], [hidden]'
  ).remove();

  // Remove tracking and analytics
  $("[data-analytics], [data-tracking], [data-gtm], [data-ga]").remove();

  // Remove all script tags and their contents
  $("script").remove();

  // Remove all style tags and their contents
  $('style, link[rel="stylesheet"]').remove();

  // Remove common non-content elements
  $(
    "noscript, iframe, svg:not([class*='pagination']), path:not([class*='pagination']), meta, link, " +
      "header, footer, aside, " +
      '[role="banner"], [role="complementary"], ' +
      ".cookie-banner, .ad, .advertisement, .social-share, " +
      "#cookie-notice, #newsletter-signup, #popup, " +
      "div:empty"
  ).remove();

  // Remove all styling and non-essential attributes
  $("*").each((_, el) => {
    if (el.type === "tag") {
      const attrs = el.attribs;
      const keepAttrs = [
        "href",
        "src",
        "alt",
        "title",
        "data-test", // Added pagination-related attributes
        "data-testid",
        "aria-current",
        "role",
        "class", // Keeping class for pagination styling
      ];

      // Don't strip attributes from pagination elements
      if (
        $(el).closest('[role="doc-pagelist"]').length ||
        $(el).closest('[data-test="pagination-page-list"]').length ||
        $(el).closest(".styles_pagination__").length
      ) {
        return;
      }

      Object.keys(attrs).forEach((attr) => {
        if (!keepAttrs.includes(attr)) {
          $(el).removeAttr(attr);
        }
      });
    }
  });

  // Remove common tracking and widget elements
  $(
    '[id*="google"], [id*="fb-"], [class*="facebook"], [class*="twitter"],' +
      '[id*="ads"], [class*="ads"], [class*="analytics"],' +
      '[class*="cookie"], [class*="newsletter"], [class*="popup"]'
  ).remove();

  // Remove empty elements (recursive)
  const removeEmpty = () => {
    const len = $("*:empty").length;
    $("*:empty").remove();
    if (len > 0) removeEmpty();
  };
  removeEmpty();

  // Remove elements with no text content (except images)
  $("div, span, p").each((_, el) => {
    const $el = $(el);
    if (!$el.text().trim() && !$el.find("img").length) {
      $el.remove();
    }
  });

  // Clean up whitespace and format
  let cleanHtml = $.html()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/>\s+</g, "><") // Remove spaces between tags
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
    .replace(/\s*([\[\]\(\){},;:])\s*/g, "$1") // Clean up spacing around punctuation
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with regular spaces
    .replace(/\s+>/g, ">") // Remove spaces before closing brackets
    .replace(/\n\s*\n/g, "\n") // Remove multiple blank lines
    .replace(/^\s*[\r\n]/gm, "") // Remove empty lines
    .trim();

  // Additional cleanup for common patterns
  cleanHtml = cleanHtml
    .replace(/<(div|span) [^>]*><\/\1>/g, "") // Remove empty containers with attributes
    .replace(/<div[^>]*>\s*<\/div>/g, ""); // Remove empty div containers

  return cleanHtml;
}

// Optional: Export specific cleanup functions for more granular control
export function removeTracking($: cheerio.CheerioAPI): void {
  $("[data-analytics], [data-tracking], [data-gtm], [data-ga]").remove();
}

export function removeAds($: cheerio.CheerioAPI): void {
  $('.ad, .advertisement, [id*="ads"], [class*="ads"]').remove();
}

export function removeWidgets($: cheerio.CheerioAPI): void {
  $(".social-share, .newsletter-signup, .cookie-notice").remove();
}

// Usage in ai-scraping.ts:
/*
import { cleanupHtml } from './cleanup-html';

// In your scraping function:
const pageContent = await page.content();
const cleanedHtml = cleanupHtml(pageContent);
await page.setContent(cleanedHtml);
*/
