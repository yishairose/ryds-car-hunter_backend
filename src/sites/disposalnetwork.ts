// Disposal Network site config for Stagehand car search
// Requires: stagehand (for logging), loginWithObserve (for login helper)
// Imports types from index.ts
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";
import { Response } from "playwright";

export function disposalnetworkConfig(stagehand: any): SiteConfig {
  return {
    name: "disposalnetwork",
    baseUrl: "https://disposalnetwork.1link.co.uk",
    loginUrl: "https://disposalnetwork.1link.co.uk/uk/tb/app/login",
    shouldNavigateToSearchUrl: false,
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to login page
        await page.goto("https://disposalnetwork.1link.co.uk/uk/tb/app/login");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);
        // Log the current URL to verify we're on the login page
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });
        await page.fill('input[placeholder="Username"]', credentials.username);
        await page.fill('input[placeholder="Password"]', credentials.password);
        await page.getByRole("button", { name: "Login" }).click();
        await page.waitForTimeout(2000);
        // Log success
        stagehand.log({
          category: "debug",
          message: "Login completed successfully",
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
    applyFilters: async (page: any, params: SearchParams) => {
      //Limited filters for disposal network. No implemntation of mileage, age, price, color
      stagehand.log({
        category: "debug",
        message: `Starting filter application for ${params.make} ${params.model}`,
      });

      const responses: Response[] = [];
      page.on("response", (resp: Response) => {
        if (
          resp.url().includes("/uk/micro/vehicles/Search") &&
          resp.request().method() === "POST" &&
          resp.status() === 200
        ) {
          responses.push(resp);
        }
      });

      console.log(responses);
      await page.getByRole("button", { name: "Search" }).click();

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      await page.locator('label:has-text("Make")').click();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('div.checkbox input[type="checkbox"]');

      // Use the actual search parameters

      await page.check(`label:has-text("${params.make.toUpperCase()}")`);
      await page.waitForTimeout(1000);

      stagehand.log({
        category: "debug",
        message: `Selected make: ${params.make}, now selecting model`,
      });

      await page.locator('label:has-text("Range")').click();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(".rangeGroup__checkboxes .checkbox");

      // Use the actual search parameters
      const modelLabel = await page.$(
        `label:has-text("${params.model.toUpperCase()}")`
      );
      if (modelLabel) {
        await modelLabel.check();
        await page.waitForTimeout(1000);
      } else {
        stagehand.log({
          category: "error",
          message: `Model \"${params.model.toUpperCase()}\" not available in filter options. Stopping process for this site.`,
        });
        throw new Error(
          `Model \"${params.model.toUpperCase()}\" not available in filter options.`
        );
      }

      await page.waitForTimeout(1000);

      stagehand.log({
        category: "debug",
        message: `Selected model: ${params.model}, now clicking search`,
      });

      await page
        .locator(".primary-filter__search button", { hasText: "Search" })
        .click();

      await page.waitForLoadState("domcontentloaded");

      await page.click('button[data-active="false"]:has-text("Filter")');
      await page.waitForTimeout(1000);
      await page.click('.accordion__header-label label:has-text("Colour")');

      // Capitalize the first letter of params.color to match the label/case in the DOM
      const color =
        (params.color?.charAt(0).toUpperCase() ?? "") +
        (params.color?.slice(1).toLowerCase() ?? "");

      // Try to find the color label
      const colorLabel = await page.$(
        `label.checkbox__label:text-is("${color}")`
      );
      if (colorLabel) {
        await colorLabel.click();
        await page.waitForTimeout(1000);
      } else {
        stagehand.log({
          category: "warn",
          message: `Color "${color}" not available in filter options, skipping color filter.`,
        });
      }

      await page.click('button.sc-ifAKCX.jWFgEz:has-text("Close")');
      // After all filter actions and waits
      if (responses.length === 0) {
        throw new Error("No matching API response found for vehicle search.");
      }
      (page as any)._lastDisposalNetworkResponse =
        responses[responses.length - 1];

      stagehand.log({
        category: "debug",
        message: "Search completed, waiting for results to load",
      });

      // Wait a bit more for results to fully load
      await page.waitForTimeout(3000);

      // Log the current URL to verify we're on the right page
      const currentUrl = page.url();
      stagehand.log({
        category: "debug",
        message: `Current URL after filtering: ${currentUrl}`,
      });
    },
    extractCars: async (page: any, params?: SearchParams) => {
      stagehand.log({
        category: "debug",
        message: "Starting API extraction for Disposal Network",
      });

      const lastResponse = (page as any)._lastDisposalNetworkResponse;
      if (!lastResponse) {
        throw new Error("No matching API response found for vehicle search.");
      }
      const data = await lastResponse.json();

      // ... process data as before
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Filtering logic
      const carData = data.vehicles
        .filter((vehicle: any) => {
          // Filter by mileage
          if (
            params?.minMileage !== undefined &&
            vehicle.mileage < params.minMileage
          )
            return false;
          if (
            params?.maxMileage !== undefined &&
            vehicle.mileage > params.maxMileage
          )
            return false;

          // Filter by age (in years, based on dateOfRegistration)
          if (vehicle.dateOfRegistration) {
            const regDate = new Date(vehicle.dateOfRegistration);
            let age = currentYear - regDate.getFullYear();
            // If registration month is after current month, subtract 1 year
            if (regDate.getMonth() + 1 > currentMonth) age--;
            if (params?.minAge !== undefined && age < params.minAge)
              return false;
            if (params?.maxAge !== undefined && age > params.maxAge)
              return false;
          }
          return true;
        })
        .map((vehicle: any) => ({
          url: `https://disposalnetwork.1link.co.uk/uk/tb/app/vehicle/${vehicle.vehicleId}`,
          imageUrl: vehicle.thumbnail,
          title: `${vehicle.make} ${vehicle.model} ${vehicle.derivative}`,
          price: vehicle.buyNowPrice,
          location: vehicle.vehicleLocationPostCode,
          registration: vehicle.regNo,
          source: "DisposalNetwork",
          timestamp: new Date().toISOString(),
        }));

      return carData;
    },
  };
}
