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
  console.log(
    `🔄 [Backend] Running ${tasks.length} tasks in batches of ${batchSize}`
  );
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batchNumber = Math.floor(i / batchSize) + 1;
    const batchStart = i + 1;
    const batchEnd = Math.min(i + batchSize, tasks.length);

    console.log(
      `📦 [Backend] Processing batch ${batchNumber}: tasks ${batchStart}-${batchEnd} of ${tasks.length}`
    );

    const batch = tasks.slice(i, i + batchSize).map((fn) => fn());
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);

    console.log(
      `✅ [Backend] Batch ${batchNumber} completed: ${batchResults.length} results`
    );
  }

  console.log(
    `🏁 [Backend] All batches completed: ${results.length} total results`
  );
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
  console.log("🚀 [Backend] Starting scraping session for all sites");
  console.log("📋 [Backend] Search parameters:", customParams);

  const stagehand = new Stagehand({
    ...StagehandConfig,
  });

  console.log("🔧 [Backend] Initializing Stagehand...");
  await stagehand.init();
  const page = stagehand.page;
  const context = stagehand.context;
  console.log("✅ [Backend] Stagehand initialized successfully");

  // Use only custom params from API, do not merge with defaults
  const searchParams: SearchParams = customParams as SearchParams;

  // Define site configurations with login functionality
  console.log("🏗️ [Backend] Setting up site configurations...");
  const siteConfigs: Record<string, SiteConfig> = {
    bca: bcaConfig(stagehand),
    CarToTrade: cartotradeConfig(stagehand),
    motorway: motorwayConfig(stagehand),
    carwow: carwowConfig(stagehand),
    disposalnetwork: disposalnetworkConfig(stagehand),
  } as const;

  console.log(
    "✅ [Backend] Site configurations loaded:",
    Object.keys(siteConfigs)
  );

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

  // Log credential status for each site
  Object.entries(siteCredentials).forEach(([siteName, creds]) => {
    const hasUsername = !!creds.username;
    const hasPassword = !!creds.password;
    console.log(
      `🔑 [Backend] ${siteName}: Username ${
        hasUsername ? "✅" : "❌"
      }, Password ${hasPassword ? "✅" : "❌"}`
    );
  });

  const allCarData: any[] = [];
  const totalSites = Object.keys(siteConfigs).length;
  let currentSiteIndex = 0;

  console.log(`🏢 [Backend] Total sites to scrape: ${totalSites}`);
  console.log("🔄 [Backend] Starting batch processing...");

  async function processSite(siteConfig: SiteConfig) {
    console.log(`\n🌐 [Backend] Starting scrape for site: ${siteConfig.name}`);
    console.log(`📅 [Backend] Site ${currentSiteIndex + 1} of ${totalSites}`);

    const newPage = await context.newPage();
    console.log(`📄 [Backend] New page created for ${siteConfig.name}`);

    try {
      console.log(
        `🔐 [Backend] Checking credentials for ${siteConfig.name}...`
      );
      if (!siteCredentials[siteConfig.name]) {
        throw new Error(`No credentials found for ${siteConfig.name}`);
      }
      const credentials = siteCredentials[siteConfig.name];
      if (!credentials.username || !credentials.password) {
        throw new Error(`Missing username or password for ${siteConfig.name}`);
      }
      console.log(`✅ [Backend] Credentials validated for ${siteConfig.name}`);

      console.log(`🔑 [Backend] Logging into ${siteConfig.name}...`);
      await siteConfig.login(newPage, credentials);
      console.log(`✅ [Backend] Successfully logged into ${siteConfig.name}`);

      console.log(`⏳ [Backend] Waiting for page to load...`);
      await newPage.waitForLoadState("domcontentloaded");
      await newPage.waitForTimeout(5_000);
      console.log(`✅ [Backend] Page loaded for ${siteConfig.name}`);
      console.log(
        `🔍 [Backend] Checking search configuration for ${siteConfig.name}...`
      );
      console.log(
        `   - shouldNavigateToSearchUrl: ${siteConfig.shouldNavigateToSearchUrl}`
      );
      console.log(
        `   - buildSearchUrl function: ${
          typeof siteConfig.buildSearchUrl === "function"
            ? "Available"
            : "Not available"
        }`
      );

      if (
        siteConfig.shouldNavigateToSearchUrl &&
        typeof siteConfig.buildSearchUrl === "function"
      ) {
        console.log(
          `🌐 [Backend] Building search URL for ${siteConfig.name}...`
        );
        const searchUrl = siteConfig.buildSearchUrl(searchParams);
        console.log(`🔗 [Backend] Search URL: ${searchUrl}`);

        console.log(`🚀 [Backend] Navigating to search URL...`);
        await newPage.goto(searchUrl);
        await newPage.waitForLoadState("domcontentloaded");
        console.log(
          `✅ [Backend] Successfully navigated to search URL for ${siteConfig.name}`
        );
      } else {
        console.log(
          `ℹ️ [Backend] No search URL navigation needed for ${siteConfig.name}`
        );
      }
      if (typeof siteConfig.applyFilters === "function") {
        console.log(`🔧 [Backend] Applying filters for ${siteConfig.name}...`);
        await siteConfig.applyFilters(newPage, searchParams);
        console.log(
          `✅ [Backend] Filters applied successfully for ${siteConfig.name}`
        );
      } else {
        console.log(`ℹ️ [Backend] No filters to apply for ${siteConfig.name}`);
      }
      let extractedData = null;
      if (typeof siteConfig.extractCars === "function") {
        console.log(
          `📊 [Backend] Starting data extraction for ${siteConfig.name}...`
        );

        // Pass params for disposalnetwork, else call as before
        if (siteConfig.name === "disposalnetwork") {
          console.log(
            `🔍 [Backend] Using disposalnetwork-specific extraction with params`
          );
          extractedData = await siteConfig.extractCars(newPage, searchParams);
        } else {
          console.log(`🔍 [Backend] Using standard extraction method`);
          extractedData = await siteConfig.extractCars(newPage);
        }

        console.log(
          `✅ [Backend] ${siteConfig.name} extracted ${
            extractedData?.length || 0
          } cars`
        );

        if (extractedData && extractedData.length > 0) {
          console.log(`🚗 [Backend] Sample car data from ${siteConfig.name}:`, {
            make: extractedData[0]?.make,
            model: extractedData[0]?.model,
            price: extractedData[0]?.price,
            year: extractedData[0]?.year,
          });
        }

        // Emit progress if callback is provided
        if (onProgress && extractedData) {
          console.log(
            `📡 [Backend] Emitting progress for ${siteConfig.name}: ${extractedData.length} cars`
          );
          onProgress(
            siteConfig.name,
            extractedData,
            totalSites,
            currentSiteIndex + 1
          );
          console.log(`✅ [Backend] Progress emitted for ${siteConfig.name}`);
        } else if (onProgress) {
          console.log(
            `⚠️ [Backend] No data to emit progress for ${siteConfig.name}`
          );
        }
      } else {
        // No extraction if no custom extractCars
        console.log(
          `ℹ️ [Backend] No extractCars function available for ${siteConfig.name}`
        );
        extractedData = null;
      }

      currentSiteIndex++;
      console.log(`🏁 [Backend] Completed scraping for ${siteConfig.name}`);
      return extractedData;
    } catch (error) {
      console.error(`❌ [Backend] Error scraping ${siteConfig.name}:`, error);
      currentSiteIndex++;
      return null;
    } finally {
      console.log(`🧹 [Backend] Closing page for ${siteConfig.name}`);
      await newPage.close();
      console.log(`✅ [Backend] Page closed for ${siteConfig.name}`);
    }
  }

  const siteConfigsArr = Object.values(siteConfigs);
  console.log(
    `🔄 [Backend] Processing ${siteConfigsArr.length} sites with concurrency limit: 2`
  );

  const results = await runInBatches(
    siteConfigsArr.map((siteConfig) => () => processSite(siteConfig)),
    Number(process.env.CONCURRENCY_LIMIT) || 2 // concurrency limit
  );

  console.log(`📊 [Backend] All sites processed, compiling results...`);
  for (const siteData of results) {
    if (siteData) {
      if (Array.isArray(siteData)) {
        allCarData.push(...siteData);
        console.log(
          `📈 [Backend] Added ${siteData.length} cars from array result`
        );
      } else {
        allCarData.push(siteData);
        console.log(`📈 [Backend] Added 1 car from single result`);
      }
    } else {
      console.log(`ℹ️ [Backend] Skipping null/undefined site data`);
    }
  }

  console.log(`🏁 [Backend] Scraping session completed!`);
  console.log(`📊 [Backend] Total cars collected: ${allCarData.length}`);
  console.log(`🔧 [Backend] Closing Stagehand...`);

  await stagehand.close();
  console.log(`✅ [Backend] Stagehand closed successfully`);

  return allCarData;
}
