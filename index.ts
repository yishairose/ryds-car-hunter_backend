import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { disposalnetworkConfig } from "./src/sites/disposalnetwork.js";
import { bcaConfig } from "./src/sites/bca.js";
import { motorwayConfig } from "./src/sites/motorway.js";
import { carwowConfig } from "./src/sites/carwow.js";
import { cartotradeConfig } from "./src/sites/cartotrade.js";
import type { SearchParams, LoginCredentials } from "./src/types/index.ts";
import { chromium } from "@playwright/test";

export type { SearchParams, LoginCredentials };

// Load environment variables
dotenv.config();

// Update SiteConfig type
type ExtractCarsFn = (page: any, params?: SearchParams) => Promise<any[]>;
export type SiteConfig = {
  name: string;
  baseUrl: string;
  loginUrl: string;
  buildSearchUrl?: (params: SearchParams) => string;
  login: (page: any, credentials: LoginCredentials) => Promise<void>;
  applyFilters: (page: any, params: SearchParams) => Promise<void>;
  filtersViaUI?: boolean;
  shouldNavigateToSearchUrl?: boolean;
  extractCars?: ExtractCarsFn;
};

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */

async function run() {
  const results = await scrapeAllSites();
  console.log(
    boxen("All extracted car data:\n" + JSON.stringify(results, null, 2), {
      padding: 1,
      margin: 1,
      title: "Car Data",
    })
  );
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack"
    )}\n`
  );
}

// Helper to run promises in batches of N
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((fn) => fn());
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

// Exported function to scrape all sites, callable from an API
export async function scrapeAllSites(
  customParams?: Partial<SearchParams>,
  onProgress?: (
    siteName: string,
    cars: any[],
    totalSites: number,
    currentSite: number
  ) => void
): Promise<any[]> {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();
  const page = stagehand.page;
  const context = stagehand.context;

  // Use only custom params from API, do not merge with defaults
  const searchParams: SearchParams = customParams as SearchParams;

  // Define site configurations with login functionality
  const siteConfigs: Record<string, SiteConfig> = {
    bca: bcaConfig(stagehand),
    CarToTrade: cartotradeConfig(stagehand),
    motorway: motorwayConfig(stagehand),
    carwow: carwowConfig(stagehand),
    disposalnetwork: disposalnetworkConfig(stagehand),
  } as const;

  // Define login credentials for each site
  const siteCredentials: Record<string, LoginCredentials> = {
    bca: {
      username: process.env.BCA_USERNAME || "",
      password: process.env.BCA_PASSWORD || "",
    },
    motorway: {
      username: process.env.MOTORWAY_USERNAME || "",
      password: process.env.MOTORWAY_PASSWORD || "",
    },
    carwow: {
      username: process.env.CARWOW_USERNAME || "",
      password: process.env.CARWOW_PASSWORD || "",
    },
    CarToTrade: {
      username: process.env.CARTOTRADE_USERNAME || "",
      password: process.env.CARWOW_PASSWORD || "",
    },
    disposalnetwork: {
      username: process.env.DISPOSALNETWORK_USERNAME || "",
      password: process.env.DISPOSALNETWORK_PASSWORD || "",
    },
  };

  const allCarData: any[] = [];
  const totalSites = Object.keys(siteConfigs).length;
  let currentSiteIndex = 0;

  async function processSite(siteConfig: SiteConfig) {
    const newPage = await context.newPage();

    try {
      if (!siteCredentials[siteConfig.name]) {
        throw new Error(`No credentials found for ${siteConfig.name}`);
      }
      const credentials = siteCredentials[siteConfig.name];
      if (!credentials.username || !credentials.password) {
        throw new Error(`Missing username or password for ${siteConfig.name}`);
      }

      await siteConfig.login(newPage, credentials);

      await newPage.waitForLoadState("domcontentloaded");
      await newPage.waitForTimeout(5_000);
      console.log(
        `shouldNavigateToSearchUrl: ${
          siteConfig.shouldNavigateToSearchUrl
        }, buildSearchUrl: ${
          typeof siteConfig.buildSearchUrl === "function"
            ? "function"
            : "not function"
        }`
      );
      if (
        siteConfig.shouldNavigateToSearchUrl &&
        typeof siteConfig.buildSearchUrl === "function"
      ) {
        const searchUrl = siteConfig.buildSearchUrl(searchParams);
        console.log(searchUrl);
        await newPage.goto(searchUrl);
        await newPage.waitForLoadState("domcontentloaded");
      }
      if (typeof siteConfig.applyFilters === "function") {
        await siteConfig.applyFilters(newPage, searchParams);
      }
      let extractedData = null;
      if (typeof siteConfig.extractCars === "function") {
        // Pass params for disposalnetwork, else call as before
        if (siteConfig.name === "disposalnetwork") {
          extractedData = await siteConfig.extractCars(newPage, searchParams);
        } else {
          extractedData = await siteConfig.extractCars(newPage);
        }
        console.log(
          siteConfig.name,
          "extracted",
          extractedData?.length || 0,
          "cars"
        );

        // Emit progress if callback is provided
        if (onProgress && extractedData) {
          onProgress(
            siteConfig.name,
            extractedData,
            totalSites,
            currentSiteIndex + 1
          );
        }
      } else {
        // No extraction if no custom extractCars
        extractedData = null;
      }

      currentSiteIndex++;
      return extractedData;
    } catch (error) {
      currentSiteIndex++;
      return null;
    } finally {
      await newPage.close();
    }
  }

  const siteConfigsArr = Object.values(siteConfigs);
  const results = await runInBatches(
    siteConfigsArr.map((siteConfig) => () => processSite(siteConfig)),
    2 // concurrency limit
  );
  for (const siteData of results) {
    if (siteData) {
      if (Array.isArray(siteData)) {
        allCarData.push(...siteData);
      } else {
        allCarData.push(siteData);
      }
    }
  }
  console.log("Combined results:", allCarData.length);
  await stagehand.close();
  return allCarData;
}
