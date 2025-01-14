import { getRestaurantKeys } from "./review-scraper";
import { Redis } from "@upstash/redis";
import { config } from "dotenv";

config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const refactordb = async () => {
  const restaurantsKeys = await getRestaurantKeys();
  for (const restaurantKey of restaurantsKeys) {
    const restaurant = await redis.hgetall(restaurantKey);
    await redis.del(restaurantKey);
    await redis.json.set(restaurantKey, "$", {
      ...restaurant,
      reviews: [],
    });
  }
};

refactordb();
