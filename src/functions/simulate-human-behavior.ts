import { Page } from "playwright-core";

export async function simulateHumanScrolling(page: Page) {
  // Get page height
  const pageHeight = await page.evaluate(
    () => document.documentElement.scrollHeight
  );
  let currentPosition = 0;

  while (currentPosition < pageHeight) {
    // Random scroll amount between 300-800 pixels
    const scrollAmount = Math.floor(Math.random() * 500) + 600;
    currentPosition += scrollAmount;

    await page.evaluate((scrollPos) => {
      window.scrollTo({
        top: scrollPos,
        behavior: "smooth",
      });
    }, currentPosition);

    // Random pause between 500-2000ms
    await page.waitForTimeout(Math.floor(Math.random() * 1500) + 500);

    // Occasionally move mouse randomly
    if (Math.random() > 0.7) {
      await page.mouse.move(Math.random() * 800, Math.random() * 600, {
        steps: 5,
      });
    }
  }

  // Ensure we've reached the bottom
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await page.waitForTimeout(1000);
}
