import { openai } from "@ai-sdk/openai";
import { runs } from "@trigger.dev/sdk/v3";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import { config } from "dotenv";
import chalk from "chalk";

config();

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function generateEmbedding(text: string) {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
    array.slice(i * chunkSize, (i + 1) * chunkSize)
  );
}

export const generateEmbeddings = async () => {
  console.log(`${chalk.blue("[EMBEDDINGS]")} Starting embedding generation`);

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
    `${chalk.blue("[EMBEDDINGS]")} Found ${allRuns.length} runs to process`
  );

  // Process all runs in parallel
  const vectorsToUpsert = await Promise.all(
    allRuns.map(async (run, i) => {
      try {
        console.log(
          `${chalk.blue("[EMBEDDINGS]")} Processing run ${i + 1}/${
            allRuns.length
          }`
        );

        const runData = await runs.retrieve(run.id);

        if (runData.status !== "COMPLETED") {
          console.warn(
            `${chalk.yellow("[WARNING]")} Run ${run.id} is ${runData.status}`
          );
          return [];
        }

        const restaurant = runData.payload.restaurant;

        if (!restaurant || !runData.output.reviews) {
          console.warn(
            `${chalk.yellow("[WARNING]")} Missing data for run ${run.id}`
          );
          return [];
        }

        // Process all reviews in parallel
        const reviewVectors = await Promise.allSettled(
          runData.output.reviews.map(async (review: any, j: number) => {
            if (!review) {
              console.warn(
                `${chalk.yellow("[WARNING]")} No review found for run ${run.id}`
              );
              return null;
            }

            try {
              const embedding = await generateEmbedding(review.text);
              return {
                id: `${restaurant.id}_review_${j}`,
                vector: embedding,
                metadata: {
                  restaurant,
                  review,
                },
              };
            } catch (error) {
              console.error(
                `${chalk.red(
                  "[ERROR]"
                )} Failed to generate embedding for review ${j} of ${
                  restaurant.name
                }:`,
                error
              );
              return null;
            }
          })
        );

        // Filter out rejected promises and null values
        const successfulVectors = reviewVectors
          .filter((result) => result.status === "fulfilled" && result.value)
          .map((result) => (result as PromiseFulfilledResult<any>).value);

        console.log(
          `${chalk.cyan("[PROGRESS]")} Generated embeddings for "${
            restaurant.name
          }"`
        );

        return successfulVectors;
      } catch (error) {
        console.error(
          `${chalk.red("[ERROR]")} Failed to process run ${run.id}:`,
          error
        );
        return [];
      }
    })
  );

  const flattenedVectors = vectorsToUpsert.flat();
  const chunks = chunkArray(flattenedVectors, 100);

  console.log(
    `${chalk.blue("[EMBEDDINGS]")} Upserting ${
      flattenedVectors.length
    } vectors in ${chunks.length} chunks`
  );

  for (const [i, chunk] of chunks.entries()) {
    try {
      await index.upsert(chunk);
      console.log(
        `${chalk.cyan("[PROGRESS]")} Completed chunk ${i + 1}/${
          chunks.length
        } (${chunk.length} vectors)`
      );
    } catch (error) {
      console.error(
        `${chalk.red("[ERROR]")} Failed to upsert chunk ${i + 1}:`,
        error
      );
    }
  }

  console.log(
    `${chalk.green("[SUCCESS]")} Successfully completed embedding generation`
  );
};

generateEmbeddings();
