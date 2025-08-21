// Motorway site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.ts";
import { getMotorwayModelName } from "./motorway/model-groups.js";

/**
 * Motorway Site Configuration
 * This function returns a complete site configuration object for the Motorway car auction website
 * It handles URL building with complex model mapping, authentication, and data extraction
 * Motorway uses URL parameters for all filtering, making it a URL-based search system
 */
export function motorwayConfig(stagehand: any): SiteConfig {
  return {
    name: "motorway",
    baseUrl: "https://pro.motorway.co.uk",
    loginUrl: "https://pro.motorway.co.uk/signin",

    /**
     * BUILD SEARCH URL FUNCTION
     * Constructs the search URL with Motorway's specific parameter format
     * Handles complex model mapping and multiple model scenarios
     * All filtering is done via URL parameters rather than client-side interaction
     */
    buildSearchUrl: (params: SearchParams) => {
      console.log("===Build search url===");

      // Validate required parameters
      if (!params.make) {
        throw new Error("Make is required but was undefined");
      }
      if (!params.model) {
        throw new Error("Model is required but was undefined");
      }

      const searchParams = new URLSearchParams();

      // STEP 1: Handle special case for Land Rover -> land-rover (URL slug conversion)
      let makeForUrl = params.make.toLowerCase();
      if (params.make.toLowerCase() === "land rover") {
        makeForUrl = "land-rover";
      }

      searchParams.set("make", makeForUrl);

      // STEP 2: Use the Motorway model mapping to get the correct model name(s)
      // This handles cases where models need to be translated to Motorway's expected format
      const motorwayModelName = getMotorwayModelName(params.make, params.model);
      console.log(
        `Motorway model mapping: "${params.model}" -> "${motorwayModelName}"`
      );

      // STEP 3: Handle both string and array model names
      if (Array.isArray(motorwayModelName)) {
        // For array models (like Lexus IS), we need to create multiple make/model pairs
        // Motorway expects: make=lexus&model=RX200&make=lexus&model=RX300&make=lexus&model=RX350...
        const makeLowerCase = params.make.toLowerCase();

        // Clear the existing searchParams and rebuild with multiple make/model pairs
        searchParams.delete("make");
        searchParams.delete("model");

        motorwayModelName.forEach((model) => {
          searchParams.append("make", makeLowerCase);
          searchParams.append("model", model);
        });

        console.log(
          `Multiple models for search: ${motorwayModelName.join(", ")}`
        );
        console.log(`Search params structure: ${searchParams.toString()}`);
      } else {
        // For single model names, simply set the model parameter
        searchParams.set("model", motorwayModelName);
      }

      // STEP 4: Add optional filter parameters if specified
      // Price range filters
      if (params.minPrice !== undefined) {
        searchParams.set("displayPriceFrom", params.minPrice.toString());
      }
      if (params.maxPrice !== undefined) {
        searchParams.set("displayPriceTo", params.maxPrice.toString());
      }

      // Mileage range filters
      if (params.minMileage !== undefined) {
        searchParams.set("mileageFrom", params.minMileage.toString());
      }
      if (params.maxMileage !== undefined) {
        searchParams.set("mileageTo", params.maxMileage.toString());
      }

      // Age range filters
      if (params.minAge !== undefined) {
        searchParams.set("ageFrom", params.minAge.toString());
      }
      if (params.maxAge !== undefined) {
        searchParams.set("ageTo", params.maxAge.toString());
      }

      // STEP 5: Construct the final search URL
      const finalUrl = `https://pro.motorway.co.uk/vehicles?${searchParams.toString()}`;
      console.log("Motorway final URL:", finalUrl);
      console.log(
        "Search parameters:",
        Object.fromEntries(searchParams.entries())
      );

      // STEP 6: Debug output for multiple model scenarios
      // For debugging: show the actual parameter structure
      if (Array.isArray(motorwayModelName)) {
        console.log("Multiple model search structure:");
        motorwayModelName.forEach((model, index) => {
          console.log(
            `  make[${index}]: ${params.make.toLowerCase()}, model[${index}]: ${model}`
          );
        });
      }

      return finalUrl;
    },

    shouldNavigateToSearchUrl: true,

    /**
     * LOGIN FUNCTION
     * Handles user authentication to the Motorway website
     * Navigates to signin page, fills credentials, and waits for successful redirect
     * Includes timeout handling for redirect verification
     */
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to the Motorway signin page
        await page.goto("https://pro.motorway.co.uk/signin");
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2_000);

        // Log current URL for debugging purposes
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        // Fill in username and password fields
        await page.fill("#username", credentials.username);
        await page.fill("#password", credentials.password);

        // Click the sign in button to authenticate
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForTimeout(2000);

        // Wait for redirect to any vehicles page (not just auction)
        // This confirms successful authentication and navigation
        try {
          await page.waitForURL("**/vehicles*", {
            timeout: 15000,
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: "Timeout waiting for redirect, checking current URL",
          });
        }

        // Wait for page to fully load after redirect
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);

        // Log final URL and completion status
        stagehand.log({
          category: "debug",
          message: `Final URL after login: ${page.url()}`,
        });
        stagehand.log({
          category: "debug",
          message: "Login and navigation completed successfully",
        });
      } catch (error) {
        // Log any login errors and re-throw for handling upstream
        stagehand.log({
          category: "error",
          message: `Login error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        throw error;
      }
    },

    // Motorway doesn't use client-side filtering - all filtering is done via URL parameters
    applyFilters: async (page: any, params: SearchParams) => {},

    /**
     * EXTRACT CARS FUNCTION
     * Extracts car data from the Motorway search results page
     * Parses individual vehicle cards to extract details like price, title, location, etc.
     * Uses Motorway's specific CSS class selectors for data extraction
     */
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting extraction for Motorway",
      });

      // Wait for page to stabilize before extraction
      await page.waitForTimeout(2000);

      // Find all vehicle cards using Motorway's specific selector pattern
      // Cards have IDs that start with "vehicle_card_"
      const cards = await page.$$('a[id^="vehicle_card_"]');
      const carData = [];

      // Iterate through each vehicle card and extract relevant information
      for (const card of cards) {
        try {
          // Extract car URL from the card link
          const url = await card.getAttribute("href");

          // Extract car image URL using Motorway's specific CSS class
          const imageUrl = await card.$eval(
            "img.VehicleCardView_vehicleListCardImage__C7eI5",
            (img: any) => img.src
          );

          // Extract car title/name from the vehicle info bar
          const title = await card.$eval(
            "section.VehicleCardView_vehicleInfoBar__sfz8Q h4",
            (el: any) => el.textContent?.trim() || ""
          );

          // Extract car price using Motorway's price CSS class
          const price = await card.$eval(
            ".VehiclePrice_price__7z4xe",
            (el: any) => el.textContent?.trim() || ""
          );

          // Extract registration number using Motorway's VRM CSS class
          const reg = await card.$eval(
            ".VRM_vrm__N4w4Q",
            (el: any) => el.textContent?.trim() || ""
          );

          // Extract location from the distance badge (looks for "mi away" text)
          const location = await card.$$eval(
            ".IconText_iconText__I_Q7L",
            (els: any[]) => {
              const el = els.find(
                (e) => e.textContent && e.textContent.includes("mi away")
              );
              return el ? el.textContent.trim() : "";
            }
          );

          // Create standardized car object and add to results array
          carData.push({
            url: url?.startsWith("/")
              ? `https://pro.motorway.co.uk${url}`
              : url,
            imageUrl,
            title,
            price: price,
            location,
            registration: reg,
            source: "Motorway",
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          // Log warning and continue with next card if extraction fails for one
          stagehand.log({
            category: "warn",
            message: "Skipping a card due to error: " + err,
          });
        }
      }

      // Return the extracted car data array
      return carData;
    },
  };
}
