import { runs } from "@trigger.dev/sdk/v3";
import chalk from "chalk";
import { createObjectCsvWriter } from "csv-writer";
import { config } from "dotenv";

config();

interface Review {
  restaurantName: string;
  reviewText: string;
  rating: number;
  date: string;
}

export const exportReviewsToCSV = async () => {
  console.log(`${chalk.blue("[CSV EXPORT]")} Starting review export`);

  // Fetch all runs
  const allRuns = [];
  try {
    let page = await runs.list({
      batch: "batch_wdiqfcj8zu57rqc394zd5",
    });
    allRuns.push(...page.data);
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      allRuns.push(...page.data);
    }
  } catch (error) {
    console.error(`${chalk.red("[ERROR]")} Failed to fetch runs:`, error);
    return;
  }

  console.log(
    `${chalk.blue("[CSV EXPORT]")} Found ${allRuns.length} runs to process`
  );

  const allReviews: Review[] = [];

  // Modify the processing section
  await Promise.all(
    allRuns.map(async (run, i) => {
      try {
        console.log(
          `${chalk.blue("[CSV EXPORT]")} Processing run ${i + 1}/${
            allRuns.length
          }`
        );

        const runData = await runs.retrieve(run.id);

        if (runData.status !== "COMPLETED") {
          console.warn(
            `${chalk.yellow("[WARNING]")} Run ${run.id} is ${runData.status}`
          );
          return;
        }

        const restaurant = runData.payload.restaurant;

        if (!restaurant || !runData.output.reviews) {
          console.warn(
            `${chalk.yellow("[WARNING]")} Missing data for run ${run.id}`
          );
          return;
        }

        // Process reviews and add them to allReviews array
        runData.output.reviews.forEach((review: any) => {
          if (review) {
            allReviews.push({
              restaurantName: restaurant.name,
              reviewText: review.text,
              rating: review.rating,
              date: review.date,
            });
          }
        });

        console.log(
          `${chalk.cyan("[PROGRESS]")} Processed reviews for "${
            restaurant.name
          }"`
        );
      } catch (error) {
        console.error(
          `${chalk.red("[ERROR]")} Failed to process run ${run.id}:`,
          error
        );
      }
    })
  );

  // Write to CSV
  const csvWriter = createObjectCsvWriter({
    path: "restaurant-reviews.csv",
    header: [
      { id: "restaurantName", title: "Restaurant Name" },
      { id: "reviewText", title: "Review" },
      { id: "rating", title: "Rating" },
      { id: "date", title: "Date" },
    ],
  });

  try {
    await csvWriter.writeRecords(allReviews);
    console.log(
      `${chalk.green("[SUCCESS]")} Successfully exported ${
        allReviews.length
      } reviews to CSV`
    );
  } catch (error) {
    console.error(`${chalk.red("[ERROR]")} Failed to write CSV file:`, error);
  }
};

exportReviewsToCSV();
