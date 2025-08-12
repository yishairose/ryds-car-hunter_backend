// Motorway site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.ts";
import { getMotorwayModelName } from "./motorway/model-groups.js";

export function motorwayConfig(stagehand: any): SiteConfig {
  return {
    name: "motorway",
    baseUrl: "https://pro.motorway.co.uk",
    loginUrl: "https://pro.motorway.co.uk/signin",
    buildSearchUrl: (params: SearchParams) => {
      console.log("===Build search url===");

      if (!params.make) {
        throw new Error("Make is required but was undefined");
      }
      if (!params.model) {
        throw new Error("Model is required but was undefined");
      }

      const searchParams = new URLSearchParams();
      const makeLowerCase = params.make.toLowerCase();
      searchParams.set("make", makeLowerCase);

      // Use the Motorway model mapping to get the correct model name(s)
      const motorwayModelName = getMotorwayModelName(params.make, params.model);
      console.log(
        `Motorway model mapping: "${params.model}" -> "${motorwayModelName}"`
      );

      // Handle both string and array model names
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
        // For single model names
        searchParams.set("model", motorwayModelName);
      }

      if (params.minPrice !== undefined) {
        searchParams.set("displayPriceFrom", params.minPrice.toString());
      }
      if (params.maxPrice !== undefined) {
        searchParams.set("displayPriceTo", params.maxPrice.toString());
      }
      if (params.minMileage !== undefined) {
        searchParams.set("mileageFrom", params.minMileage.toString());
      }
      if (params.maxMileage !== undefined) {
        searchParams.set("mileageTo", params.maxMileage.toString());
      }
      if (params.minAge !== undefined) {
        searchParams.set("ageFrom", params.minAge.toString());
      }
      if (params.maxAge !== undefined) {
        searchParams.set("ageTo", params.maxAge.toString());
      }

      const finalUrl = `https://pro.motorway.co.uk/vehicles?${searchParams.toString()}`;
      console.log("Motorway final URL:", finalUrl);
      console.log(
        "Search parameters:",
        Object.fromEntries(searchParams.entries())
      );

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
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        await page.goto("https://pro.motorway.co.uk/signin");
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2_000);
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        await page.fill("#username", credentials.username);
        await page.fill("#password", credentials.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForTimeout(2000);
        // Wait for redirect to any vehicles page (not just auction)
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
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);
        stagehand.log({
          category: "debug",
          message: `Final URL after login: ${page.url()}`,
        });
        stagehand.log({
          category: "debug",
          message: "Login and navigation completed successfully",
        });
      } catch (error) {
        stagehand.log({
          category: "error",
          message: `Login error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        throw error;
      }
    },
    applyFilters: async (page: any, params: SearchParams) => {},
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting extraction for Motorway",
      });

      await page.waitForTimeout(2000);
      // Use the correct selector for Motorway cards
      const cards = await page.$$('a[id^="vehicle_card_"]');
      const carData = [];

      for (const card of cards) {
        try {
          const url = await card.getAttribute("href");
          const imageUrl = await card.$eval(
            "img.VehicleCardView_vehicleListCardImage__C7eI5",
            (img: any) => img.src
          );
          const title = await card.$eval(
            "section.VehicleCardView_vehicleInfoBar__sfz8Q h4",
            (el: any) => el.textContent?.trim() || ""
          );
          const price = await card.$eval(
            ".VehiclePrice_price__7z4xe",
            (el: any) => el.textContent?.trim() || ""
          );
          const reg = await card.$eval(
            ".VRM_vrm__N4w4Q",
            (el: any) => el.textContent?.trim() || ""
          );
          // Location: find the badge with "mi away"
          const location = await card.$$eval(
            ".IconText_iconText__I_Q7L",
            (els: any[]) => {
              const el = els.find(
                (e) => e.textContent && e.textContent.includes("mi away")
              );
              return el ? el.textContent.trim() : "";
            }
          );

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
          stagehand.log({
            category: "warn",
            message: "Skipping a card due to error: " + err,
          });
        }
      }

      return carData;
    },
  };
}
