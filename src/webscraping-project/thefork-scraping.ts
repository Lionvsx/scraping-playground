import { Redis } from "@upstash/redis";
import axios from "axios";
import { config } from "dotenv";
import { SearchRestaurant } from "../types/restaurant";

config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function main() {
  let page = 1;

  try {
    while (true) {
      const response = await axios.get(
        `https://www.thefork.fr/_next/data/nPb3Lj7lt3DWF_psXNp1Y/fr-FR/search/cityTag/paris/415144.json?p=${page}&citySlug=paris&cityId=415144`,
        {
          headers: {
            accept: "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            cookie:
              'tf_session=session-MU1Bg1o5U98wbi75u8oo5; device_id=236a388df27e96668e5c3c20afa8543026f9b3bf5a673ae4a2e670399a635d05; connected=false; _evidon_consent_cookie={"consent_date":"2024-12-11T15:47:50.598Z","gpc":0,"consent_type":1}; tf_evidon_consent={%22advertising%22:true%2C%22analytics%20&%20customisation%22:true%2C%22essential%22:true}; trackingId=96509805-306b-48ad-bb25-66e57c278a01; __stripe_mid=7bf6d656-d142-4147-af04-59f7548190879c394a; LAST_VIEWED_RESTAURANT=2ebd5567-30ab-4277-b907-810c3b9728df; tf_ab_test=otp_second_device%3Dout%3Bwng_seo_ns_nm%3Dcon; CC=15102-e75; tf_abtests_freshness=true; tf_visit=true; source_code=2025-01-10T12:10:06||direct|15102-e75|; datadome=6hKAplF0PDZTqG6APFJHfpo7~8ogFisyaV7AEjtv8QUpGv1063ZE9k4XEsZto9V8YiB4Sb9me3UiUh_TJKRwjBMCytDV9K4u_KAjcnK7XuleFU8HilGkjshEcBWuyzOz; _dd_s=rum=0&expire=1736512357799',
            dnt: "1",
            priority: "u=1, i",
            referer: "https://www.thefork.fr/restaurants/paris-c415144?p=2",
            "sec-ch-device-memory": "8",
            "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-arch": '"arm"',
            "sec-ch-ua-full-version-list":
              '"Chromium";v="131.0.6778.205", "Not_A Brand";v="24.0.0.0"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-model": '""',
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

        const restaurantKey = `restaurant:${restaurant.id}`;

        await redis.json.set(restaurantKey, "$", {
          id: restaurantKey,
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
          reviews: [],
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
