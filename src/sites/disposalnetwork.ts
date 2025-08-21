// Disposal Network site config for Stagehand car search
// Requires: stagehand (for logging), loginWithObserve (for login helper)
// Imports types from index.ts
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";
import { Response } from "playwright";

/**
 * Disposal Network Site Configuration
 * This function returns a complete site configuration object for the Disposal Network car auction website
 * It handles authentication, basic filtering (make/model only), and data extraction via API responses
 * Disposal Network has limited filtering options compared to other sites
 */
export function disposalnetworkConfig(stagehand: any): SiteConfig {
  return {
    name: "disposalnetwork",
    baseUrl: "https://disposalnetwork.1link.co.uk",
    loginUrl: "https://disposalnetwork.1link.co.uk/uk/tb/app/login",
    shouldNavigateToSearchUrl: false,

    /**
     * LOGIN FUNCTION
     * Handles user authentication to the Disposal Network website
     * Simple login process with username/password fields and login button
     */
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to the Disposal Network login page
        await page.goto("https://disposalnetwork.1link.co.uk/uk/tb/app/login");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);

        // Log the current URL to verify we're on the login page
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        // Fill in username and password fields
        await page.fill('input[placeholder="Username"]', credentials.username);
        await page.fill('input[placeholder="Password"]', credentials.password);

        // Click the login button to authenticate
        await page.getByRole("button", { name: "Login" }).click();
        await page.waitForTimeout(2000);

        // Log successful login completion
        stagehand.log({
          category: "debug",
          message: "Login completed successfully",
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

    /**
     * APPLY FILTERS FUNCTION
     * Applies basic search filters to narrow down car results
     * Limited filtering options: only make, model, color (no mileage, age, price)
     * Captures API responses for data extraction
     */
    applyFilters: async (page: any, params: SearchParams) => {
      // Limited filters for disposal network. No implementation of mileage, age, price
      stagehand.log({
        category: "debug",
        message: `Starting filter application for ${params.make} ${params.model}`,
      });

      // STEP 1: Set up response listener to capture API calls
      // This will be used later to extract vehicle data from the search response
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

      // STEP 2: Click initial search button to load filter options
      await page.getByRole("button", { name: "Search" }).click();

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // STEP 3: Apply Make filter
      await page.locator('label:has-text("Make")').click();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('div.checkbox input[type="checkbox"]');

      // Find and select the make checkbox using the actual search parameters
      const makeLabel = await page.$(
        `label:has-text("${params.make.toUpperCase()}")`
      );
      if (makeLabel) {
        await makeLabel.check();
        await page.waitForTimeout(1000);
        // Mark that make filter was applied successfully
        (page as any)._disposalnetworkMakeApplied = true;
      } else {
        stagehand.log({
          category: "warn",
          message: `Make "${params.make.toUpperCase()}" not available in filter options. Skipping this site gracefully.`,
        });
        // Mark that make filter was not applied
        (page as any)._disposalnetworkMakeApplied = false;
        // Don't throw error, just return early
        return;
      }

      stagehand.log({
        category: "debug",
        message: `Selected make: ${params.make}, now selecting model`,
      });

      // STEP 4: Apply Model filter
      await page.locator('label:has-text("Range")').click();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(".rangeGroup__checkboxes .checkbox");

      // Find and select the model checkbox using the actual search parameters
      const modelLabel = await page.$(
        `label:has-text("${params.model.toUpperCase()}")`
      );
      if (modelLabel) {
        await modelLabel.check();
        await page.waitForTimeout(1000);
        // Mark that model filter was applied successfully
        (page as any)._disposalnetworkModelApplied = true;
      } else {
        stagehand.log({
          category: "warn",
          message: `Model \"${params.model.toUpperCase()}\" not available in filter options. Skipping this site gracefully.`,
        });
        // Mark that model filter was not applied
        (page as any)._disposalnetworkModelApplied = false;
        // Don't throw error, just return early
        return;
      }

      await page.waitForTimeout(1000);

      stagehand.log({
        category: "debug",
        message: `Selected model: ${params.model}, now clicking search`,
      });

      // STEP 5: Execute search with selected filters
      await page
        .locator(".primary-filter__search button", { hasText: "Search" })
        .click();

      await page.waitForLoadState("domcontentloaded");

      // STEP 6: Apply Color filter (optional, if color parameter is provided)
      await page.click('button[data-active="false"]:has-text("Filter")');
      await page.waitForTimeout(1000);
      await page.click('.accordion__header-label label:has-text("Colour")');

      // Capitalize the first letter of params.color to match the label/case in the DOM
      const color =
        (params.color?.charAt(0).toUpperCase() ?? "") +
        (params.color?.slice(1).toLowerCase() ?? "");

      // Try to find and select the color label
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

      // Close the filter panel
      await page.click('button.sc-ifAKCX.jWFgEz:has-text("Close")');

      // STEP 7: Verify API response was captured and store for extraction
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

    /**
     * EXTRACT CARS FUNCTION
     * Extracts car data from the API response captured during filtering
     * Applies additional filtering logic for price, mileage, and age
     * Returns standardized car objects with all relevant information
     */
    extractCars: async (page: any, params?: SearchParams) => {
      stagehand.log({
        category: "debug",
        message: "Starting API extraction for Disposal Network",
      });

      // STEP 1: Verify that required filters were applied successfully
      // Check if make filter was applied (might have failed)
      if ((page as any)._disposalnetworkMakeApplied === false) {
        console.log(
          "⚠️ [DisposalNetwork] Make filter was not applied due to unavailable make. Returning 0 results gracefully."
        );
        return [];
      }

      // Check if model filter was applied (might have failed)
      if ((page as any)._disposalnetworkModelApplied === false) {
        console.log(
          "⚠️ [DisposalNetwork] Model filter was not applied due to unavailable model. Returning 0 results gracefully."
        );
        return [];
      }

      // STEP 2: Retrieve the captured API response from the filtering process
      const lastResponse = (page as any)._lastDisposalNetworkResponse;
      if (!lastResponse) {
        throw new Error("No matching API response found for vehicle search.");
      }
      const data = await lastResponse.json();

      console.log(
        `[DisposalNetwork] Raw API response: ${
          data.vehicles?.length || 0
        } vehicles found`
      );

      // Wait for page to stabilize
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // STEP 3: Calculate current date for age calculations
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // STEP 4: Apply additional filtering logic that wasn't available in the UI
      // All filtering now done in data processing stage for better control
      const carData = data.vehicles.filter((vehicle: any) => {
        // Filter by price range (if specified)
        if (
          params?.minPrice !== undefined &&
          vehicle.buyNowPrice < params.minPrice
        )
          return false;
        if (
          params?.maxPrice !== undefined &&
          vehicle.buyNowPrice > params.maxPrice
        )
          return false;

        // Filter by mileage range (if specified)
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

        // Filter by age range (if specified)
        // Calculate age based on dateOfRegistration
        if (vehicle.dateOfRegistration) {
          const regDate = new Date(vehicle.dateOfRegistration);
          let age = currentYear - regDate.getFullYear();
          // If registration month is after current month, subtract 1 year
          if (regDate.getMonth() + 1 > currentMonth) age--;
          if (params?.minAge !== undefined && age < params.minAge) return false;
          if (params?.maxAge !== undefined && age > params.maxAge) return false;
        }
        return true;
      });

      console.log(
        `[DisposalNetwork] After filtering: ${carData.length} vehicles remain`
      );

      // STEP 5: Transform filtered data into standardized car objects
      const finalCarData = carData.map((vehicle: any) => ({
        url: `https://disposalnetwork.1link.co.uk/uk/tb/app/vehicle/${vehicle.vehicleId}`,
        imageUrl: vehicle.thumbnail,
        title: `${vehicle.make} ${vehicle.model} ${vehicle.derivative}`,
        price: vehicle.buyNowPrice,
        location: vehicle.vehicleLocationPostCode,
        registration: vehicle.regNo,
        source: "DisposalNetwork",
        timestamp: new Date().toISOString(),
      }));

      // Return the processed and filtered car data
      return finalCarData;
    },
  };
}
