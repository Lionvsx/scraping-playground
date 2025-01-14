import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";

const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

// Add these user agent strings
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
];

async function getHtmlContent() {
  const browser = await chromium.launch();

  const context = await browser.newContext({
    userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    viewport: {
      width: 1920,
      height: 1080,
    },
    // Add additional browser context options
    geolocation: { longitude: 2.3522, latitude: 48.8566 }, // Paris coordinates
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });

  const page = await context.newPage();

  // Add random delays between actions
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);

  // Add headers
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  });

  // Random delay before navigation
  await page.waitForTimeout(2000 + Math.random() * 2000);

  await page.goto(
    "https://www.tripadvisor.fr/Restaurant_Review-g187147-d10145677-Reviews-Mezze_De_Beyrouth-Paris_Ile_de_France.html",
    {
      waitUntil: "networkidle",
      timeout: 30000,
    }
  );

  // Random delay before getting content
  await page.waitForTimeout(1000 + Math.random() * 2000);

  const content = await page.content();
  await browser.close();
  return content;
}

interface Review {
  title: string;
  rating: number;
  text: string;
  author: string;
  date: string;
}

function scrapeReviews(html: string): Review[] {
  const $ = cheerio.load(html);
  const reviews: Review[] = [];

  $("div._c").each((_, reviewEl) => {
    const element = $(reviewEl);

    // Get rating from SVG title (e.g. "5 sur 5 bulles")
    const ratingText = element.find("svg.UctUV.d.H0 title").text();
    const rating = parseInt(ratingText.split(" ")[0]) || 0;

    const review: Review = {
      title: element.find("div.biGQs._P.fiohW.qWPrE.ncFvv.fOtGX").text().trim(),
      rating,
      text: element.find("span.JguWG").text().trim(),
      author: element
        .find("a.BMQDV._F.Gv.wSSLS.SwZTJ.FGwzt.ukgoS")
        .text()
        .trim(),
      date: element
        .find("div.biGQs._P.pZUbB.ncFvv.osNWb")
        .text()
        .replace("Rédigé le", "")
        .trim(),
    };

    reviews.push(review);
  });

  console.log(`Successfully scraped ${reviews.length} reviews`);
  return reviews;
}

// -----------------------------------
// Usage example (scraping from a file):
// -----------------------------------

async function main() {
  // 1. Read HTML from file (or from a request/response
  const htmlContent = await getHtmlContent();

  // 2. Scrape reviews
  const reviews = scrapeReviews(htmlContent);

  // 3. Do something with the results, e.g. print them
  console.log(JSON.stringify(reviews, null, 2));
}

main();
