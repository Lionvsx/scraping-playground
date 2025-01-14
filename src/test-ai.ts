import { scrape } from "./functions/ai-scraping";

(async () => {
  const result = await scrape({
    url: "https://www.tripadvisor.fr/Restaurant_Review-g187147-d28043991-Reviews-ONYX-Paris_Ile_de_France.html",
    scrapingSchema: `
    reviews[] = {
      title: string
      rating: number
      date: string
      text: string
      author: string
    }
  `,
  });

  if (result.hasError) {
    console.error(result.errorMessage);
  } else {
    console.log(result.data);
  }
})();
