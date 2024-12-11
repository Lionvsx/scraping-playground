import { Redis } from "@upstash/redis";
import axios from "axios";
import { SearchRestaurant } from "./types/restaurant";
import { config } from "dotenv";

config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function main() {
  let page = 10;

  try {
    while (true) {
      const response = await axios.get(
        `https://www.thefork.fr/_next/data/eAyE31Cf2-pxt4nAYAo_S/fr-FR/search/cityTag/paris/415144.json?p=${page}`,
        {
          headers: {
            authority: "www.thefork.fr",
            accept: "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            dnt: "1",
            referer: "https://www.thefork.fr/restaurants/paris-c415144",
            "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "x-nextjs-data": "1",
          },
          validateStatus: (status) => status < 500,
        }
      );

      console.info(`Fetching page ${page}`);

      const allRestaurants = response.data.pageProps
        .searchPageResultsFetchResult.list as SearchRestaurant[];

      if (allRestaurants.length === 0) {
        break;
      }

      for (const searchItem of allRestaurants) {
        const restaurant = searchItem.restaurant;

        await redis.hset(`restaurant:${restaurant.id}`, {
          name: restaurant.name,
          slug: restaurant.slug,
          cuisine: restaurant.servesCuisine,
          priceLevel: restaurant.priceRangeLevel || 0,
          averagePrice: restaurant.averagePrice || 0,
          currency: restaurant.currency?.isoCurrency || "",
          rating: restaurant.aggregateRatings?.thefork?.ratingValue || 0,
          reviewCount: restaurant.aggregateRatings?.thefork?.reviewCount || 0,
          // Address
          country: restaurant.address?.country || "",
          locality: restaurant.address?.locality || "",
          zipCode: restaurant.address?.zipCode || "",
          street: restaurant.address?.street || "",
          // Geolocation
          latitude: restaurant.geolocation?.latitude || 0,
          longitude: restaurant.geolocation?.longitude || 0,
        });

        // Validate price level before adding to price index
        if (
          typeof restaurant.priceRangeLevel === "number" &&
          !isNaN(restaurant.priceRangeLevel)
        ) {
          await redis.zadd("restaurants:by:price", {
            score: restaurant.priceRangeLevel,
            member: restaurant.id,
          });
        }

        // Validate rating before adding to rating index
        const rating = restaurant.aggregateRatings?.thefork?.ratingValue;
        if (typeof rating === "number" && !isNaN(rating)) {
          await redis.zadd("restaurants:by:rating", {
            score: rating,
            member: restaurant.id,
          });
        }

        // Only add cuisine if it exists
        if (restaurant.servesCuisine) {
          await redis.sadd(
            `restaurants:cuisine:${restaurant.servesCuisine}`,
            restaurant.id
          );
        }

        // Only add locality if it exists
        if (restaurant.address?.locality) {
          await redis.sadd(
            `restaurants:locality:${restaurant.address.locality}`,
            restaurant.id
          );
        }
      }

      page++;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
