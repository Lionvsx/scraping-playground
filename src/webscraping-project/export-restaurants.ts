import { Redis } from "@upstash/redis";
import chalk from "chalk";
import { createObjectCsvWriter } from "csv-writer";
import { config } from "dotenv";
import { getRestaurantKeys } from "../review-scraper";
import { Restaurant } from "../types/db-restaurant";

config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

type RestaurantResult = [Restaurant];

async function exportRestaurants() {
  console.log(`${chalk.blue("[EXPORT]")} Starting restaurant export`);

  const keys = await getRestaurantKeys();
  console.log(`${chalk.blue("[EXPORT]")} Found ${keys.length} restaurants`);

  const pipeline = redis.pipeline();

  // Queue all requests
  keys.forEach((key) => {
    pipeline.json.get(key, "$");
  });

  // Execute pipeline
  const results = await pipeline.exec<RestaurantResult[]>();

  // Process results - pipeline.exec returns [null, data] tuples
  const restaurants = results.filter(Boolean).map((result) => result[0]);

  const csvWriter = createObjectCsvWriter({
    path: "restaurants.csv",
    header: [
      { id: "name", title: "Name" },
      { id: "slug", title: "Slug" },
      { id: "cuisine", title: "Cuisine" },
      { id: "priceLevel", title: "Price Level" },
      { id: "averagePrice", title: "Average Price" },
      { id: "currency", title: "Currency" },
      { id: "rating", title: "Rating" },
      { id: "reviewCount", title: "Review Count" },
      { id: "street", title: "Street" },
      { id: "zipCode", title: "Zip Code" },
      { id: "locality", title: "Locality" },
      { id: "country", title: "Country" },
      { id: "latitude", title: "Latitude" },
      { id: "longitude", title: "Longitude" },
    ],
  });

  await csvWriter.writeRecords(restaurants as Restaurant[]);
  console.log(
    `${chalk.green("[SUCCESS]")} Exported ${
      restaurants.length
    } restaurants to CSV`
  );
}

exportRestaurants();
