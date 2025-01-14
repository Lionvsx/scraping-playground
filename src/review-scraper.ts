import { Redis } from "@upstash/redis";
import { config } from "dotenv";

config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getRestaurantKeys() {
  let cursor = "0";
  const restaurantKeys: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "restaurant:*",
      count: 500,
    });
    restaurantKeys.push(...keys);

    cursor = nextCursor;
  } while (cursor !== "0");

  return restaurantKeys;
}

async function main() {
  try {
    const restaurantKeys = await getRestaurantKeys();

    console.log(`Total keys fetched: ${restaurantKeys.length}`);
  } catch (error) {
    console.error(error);
  }
}

main();
