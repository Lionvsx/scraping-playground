import { promises as fs } from "fs";

// Function to load proxies from a file
export async function loadProxies(filePath: string): Promise<string[]> {
  const data = await fs.readFile(filePath, "utf-8");
  return data.split("\n").filter((line) => line.trim() !== "");
}

// Function to get a random proxy from the list
export function getRandomProxy(proxies: string[]): string {
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
}

export async function readAndPickProxy(): Promise<string> {
  const proxies = await loadProxies("proxies.txt");
  return getRandomProxy(proxies);
}
