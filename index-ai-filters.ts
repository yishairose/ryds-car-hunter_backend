import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import type { Page as StagehandPage } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { z } from "zod";

// Define the search parameters type
type SearchParams = {
  make: string;
  model: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  minMileage: number;
  maxMileage: number;
};

// Define login credentials type
type LoginCredentials = {
  username: string;
  password: string;
};

// Define site configuration type
type SiteConfig = {
  name: string;
  baseUrl: string;
  loginUrl: string;
  applyFilters: (page: StagehandPage, params: SearchParams) => Promise<void>;
  login: (page: StagehandPage, credentials: LoginCredentials) => Promise<void>;
};

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  // Define site configurations with login functionality
  const siteConfigs: Record<string, SiteConfig> = {
    motorway: {
      name: "motorway",
      baseUrl: "https://pro.motorway.co.uk",
      loginUrl: "https://pro.motorway.co.uk/signin",
      applyFilters: async (page: StagehandPage, params: SearchParams) => {
        try {
          // Ensure we're on the correct page
          const currentUrl = page.url();
          if (!currentUrl.includes("/vehicles?listType=auction")) {
            await page.goto(
              "https://pro.motorway.co.uk/vehicles?listType=auction"
            );
          }

          // Wait for the page to be fully loaded and interactive
          await page.waitForLoadState("domcontentloaded");
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(3000);

          // Click the filter button first
          await page.act("Click the filter button to show filter options");
          await page.waitForTimeout(1000);

          // Apply make filter
          await page.act("Click the make filter dropdown");
          await page.waitForTimeout(1000);
          await page.act(
            `Select ${params.make.toUpperCase()} from the make dropdown`
          );
          await page.waitForTimeout(1000);

          // Apply model filter
          await page.act("Click the model filter dropdown");
          await page.waitForTimeout(1000);
          await page.act(
            `Select ${params.model.toUpperCase()} from the model dropdown`
          );
          await page.waitForTimeout(1000);

          //   // Apply year range
          //   await page.act("Click the year filter");
          //   await page.waitForTimeout(1000);
          //   await page.act(`Set minimum year to ${params.minYear}`);
          //   await page.waitForTimeout(1000);
          //   await page.act(`Set maximum year to ${params.maxYear}`);
          //   await page.waitForTimeout(1000);
          //   await page.act("Click apply on the year filter");

          //   // Apply price range
          //   await page.act("Click the price filter");
          //   await page.waitForTimeout(1000);
          //   await page.act(`Set maximum price to ${params.maxPrice}`);
          //   await page.waitForTimeout(1000);
          //   await page.act("Click apply on the price filter");

          //   // Apply mileage range
          //   await page.act("Click the mileage filter");
          //   await page.waitForTimeout(1000);
          //   await page.act(`Set minimum mileage to ${params.minMileage}`);
          //   await page.waitForTimeout(1000);
          //   await page.act(`Set maximum mileage to ${params.maxMileage}`);
          //   await page.waitForTimeout(1000);
          //   await page.act("Click apply on the mileage filter");

          // Wait for results to load
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(2000);

          stagehand.log({
            category: "debug",
            message: "Filters applied successfully",
          });
        } catch (error) {
          stagehand.log({
            category: "error",
            message: `Error applying filters: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          throw error;
        }
      },
      login: async (page: StagehandPage, credentials: LoginCredentials) => {
        try {
          // Navigate to login page
          await page.goto(siteConfigs.motorway.loginUrl);

          // Wait for the page to be ready
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(2_000);

          // Log the current URL to verify we're on the login page
          const currentUrl = page.url();
          stagehand.log({
            category: "debug",
            message: `Current URL: ${currentUrl}`,
          });

          // Perform login
          await loginWithObserve(
            page,
            credentials.username,
            credentials.password
          );

          // Wait for navigation to complete
          try {
            // First try waiting for the redirect
            await page.waitForURL("**/vehicles?listType=auction", {
              timeout: 15000,
            });
          } catch (error) {
            stagehand.log({
              category: "warn",
              message: "Timeout waiting for redirect, checking current URL",
            });
          }

          // Check if we're already on the vehicles page
          const finalUrl = page.url();
          if (!finalUrl.includes("/vehicles")) {
            stagehand.log({
              category: "warn",
              message:
                "Not redirected to vehicles page, attempting to navigate manually",
            });
            // Try to navigate to the vehicles page
            await page.goto(
              `${siteConfigs.motorway.baseUrl}/vehicles?listType=auction`,
              {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              }
            );
          }

          // Wait for the page to be interactive
          await page.waitForLoadState("domcontentloaded");

          // Add a small delay to ensure everything is loaded
          await page.waitForTimeout(2000);

          // Log current URL to confirm
          stagehand.log({
            category: "debug",
            message: `Final URL after login: ${page.url()}`,
          });

          // Log success
          stagehand.log({
            category: "debug",
            message: "Login and navigation completed successfully",
          });
        } catch (error) {
          // Log any errors
          stagehand.log({
            category: "error",
            message: `Login error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          throw error;
        }
      },
    },
  };

  // Define login credentials for each site
  const siteCredentials: Record<string, LoginCredentials> = {
    motorway: {
      username: process.env.MOTORWAY_USERNAME || "",
      password: process.env.MOTORWAY_PASSWORD || "",
    },
  };

  // Define search parameters
  const searchParams: SearchParams = {
    make: "FORD",
    model: "FOCUS",
    minPrice: 1000,
    maxPrice: 30000,
    minYear: 2018,
    maxYear: 2023,
    minMileage: 0,
    maxMileage: 150000,
  };

  // Function to process each site
  async function processSite(siteConfig: SiteConfig) {
    const newPage = (await context.newPage()) as StagehandPage;
    try {
      // Login first
      stagehand.log({
        category: "debug",
        message: `Starting login process for ${siteConfig.name}`,
      });

      await siteConfig.login(newPage, siteCredentials[siteConfig.name]);

      // Wait for login to complete and verify we're logged in
      await newPage.waitForLoadState("domcontentloaded");
      await newPage.waitForTimeout(5_000);

      // Apply filters using AI selectors
      stagehand.log({
        category: "debug",
        message: `Applying filters for ${siteConfig.name}`,
      });

      await siteConfig.applyFilters(newPage, searchParams);

      // Copy cookies from the logged-in page to the Stagehand page
      const cookies = await newPage.context().cookies();
      await stagehand.context.addCookies(cookies);

      // Use Stagehand page for extraction
      stagehand.log({
        category: "debug",
        message: `Navigating to search URL on Stagehand page for ${siteConfig.name}`,
      });

      await stagehand.page.waitForTimeout(1000);
      await stagehand.page.goto(newPage.url(), {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await stagehand.page.waitForTimeout(2_000);

      // Extract data using Stagehand
      stagehand.log({
        category: "debug",
        message: `Extracting data from ${siteConfig.name}`,
      });

      const extraction = await stagehand.page.extract(
        "Extract all car listings from the search results page. For each car, get the make, model, year, mileage, price, and location."
      );

      // Log the extracted data
      stagehand.log({
        category: "car-search",
        message: `Extracted car data from ${siteConfig.name}`,
        auxiliary: {
          data: {
            value: extraction.extraction || "No data extracted",
            type: "string",
          },
        },
      });

      // Only close the page after successful data extraction
      stagehand.log({
        category: "debug",
        message: `Successfully completed processing for ${siteConfig.name}`,
      });
    } catch (error) {
      stagehand.log({
        category: "error",
        message: `Error processing ${siteConfig.name}`,
        auxiliary: {
          error: {
            value: error instanceof Error ? error.message : String(error),
            type: "string",
          },
        },
      });
    } finally {
      // Close the page only after all processing is complete
      await newPage.close();
    }
  }

  // Process all sites sequentially
  for (const siteConfig of Object.values(siteConfigs)) {
    try {
      await processSite(siteConfig);
    } catch (error) {
      stagehand.log({
        category: "error",
        message: `Failed to process ${siteConfig.name}`,
        auxiliary: {
          error: {
            value: error instanceof Error ? error.message : String(error),
            type: "string",
          },
        },
      });
    }
  }
}

async function loginWithObserve(page: Page, email: string, password: string) {
  const [emailField] = await page.observe("Enter email");
  await page.act({ ...emailField, method: "fill", arguments: [email] });

  const [passwordField] = await page.observe("Enter password");
  await page.act({ ...passwordField, method: "fill", arguments: [password] });

  const [loginButton] = await page.observe("Click login or sign in");
  await page.act(loginButton);
}

async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        }
      )
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  await main({
    page,
    context,
    stagehand,
  });
  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack"
    )}\n`
  );
}

run();
