import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

(async () => {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    verbose: 2,
    headless: false,
    enableCaching: true,
    modelName: "gpt-4o",
    logger: (logLine) => {
      console.log(`[${logLine.category}] ${logLine.message}`);
    },
  });

  await stagehand.init();
  await stagehand.page.goto(
    "https://www.tripadvisor.fr/Restaurant_Review-g187454-d6969567-Reviews-KUMA-Bilbao_Province_of_Vizcaya_Basque_Country.html",
    {
      waitUntil: "networkidle",
      timeout: 60000,
    }
  );

  const reviews = await stagehand.page.extract({
    instruction: "extract all reviews",
    schema: z.object({
      reviews: z.array(
        z.object({
          title: z.string(),
          rating: z.number(),
          date: z.string(),
          text: z.string(),
        })
      ),
    }),
    useTextExtract: true,
  });

  console.log(reviews);
  await stagehand.close();
})();
