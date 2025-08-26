// Carwow site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";
import { modelGroupMap } from "./carwow/model-groups.js";

/**
 * Carwow Site Configuration
 * This function returns a complete site configuration object for the Carwow car dealership website
 * It handles authentication, filtering, and data extraction for car searches
 */
export function carwowConfig(stagehand: any): SiteConfig {
  return {
    name: "carwow",
    baseUrl: "https://dealers.carwow.co.uk",
    loginUrl:
      "https://auth.carwow.co.uk/u/login?state=hKFo2SB6SjR1UFZkeHBMcUhfc0h5SS15Z0p0ZktYbmxPUVV4WaFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIGxITkZHM2tTM0l4RGRFQVhJSVpKWjFaQ25xM1pmNEJHo2NpZNkgSVNLd0IxcGJMSjl1UVVoRnkwdFhPYzc2aDJwdUthUlM",

    /**
     * LOGIN FUNCTION
     * Handles user authentication to the Carwow website
     * Navigates to login page, fills credentials, and completes the login process
     */
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to the Carwow authentication page
        await page.goto(
          "https://auth.carwow.co.uk/u/login?state=hKFo2SB6SjR1UFZkeHBMcUhfc0h5SS15Z0p0ZktYbmxPUVV4WaFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIGxITkZHM2tTM0l4RGRFQVhJSVpKWjFaQ25xM1pmNEJHo2NpZNkgSVNLd0IxcGJMSjl1UVVoRnkwdFhPYzc2aDJwdUthUlM"
        );

        // Wait for page to fully load and stabilize
        await page.waitForLoadState("networkidle");
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

        // Click the continue button to proceed with login
        await page.getByRole("button", { name: "Continue" }).click();
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
     * Applies search filters to narrow down car results based on user parameters
     * Handles make, model, age, and mileage filtering with special logic for series models
     */
    applyFilters: async (page: any, params: SearchParams) => {
      try {
        stagehand.log({
          category: "debug",
          message: "Filtering Carwow",
        });

        // Wait for page to be fully loaded before applying filters
        await page.waitForLoadState("domcontentloaded");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        // STEP 1: Select listing type (All vehicles) - with error handling
        try {
          const listingTypeLabel = await page.$(
            'label[for="filters-modal-desktop-listing_type__all"]'
          );
          if (listingTypeLabel) {
            await listingTypeLabel.click();
            await page.waitForTimeout(1000);
          } else {
            stagehand.log({
              category: "warn",
              message: "Listing type filter not found, continuing without it",
            });
          }
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not set listing type: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }

        // STEP 2: Open Make filter dropdown - with error handling
        try {
          const makeButton = await page.getByRole("button", { name: "Make" });
          if (await makeButton.isVisible()) {
            await makeButton.click();
            await page.waitForTimeout(1000);
          } else {
            stagehand.log({
              category: "warn",
              message:
                "Make filter button not visible, continuing without make filter",
            });
            (page as any)._carwowModelApplied = false;
            return;
          }
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not open make filter: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          (page as any)._carwowModelApplied = false;
          return;
        }

        // Search for the specified make in the filter
        try {
          const searchInput = await page.$(
            'input[data-selling--filters-search-target="searchInput"][id="brand_slugs-search"]'
          );
          if (searchInput) {
            await searchInput.fill(params.make);
            await page.waitForTimeout(1000);
          } else {
            stagehand.log({
              category: "warn",
              message: "Make search input not found",
            });
            (page as any)._carwowModelApplied = false;
            return;
          }
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not search for make: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          (page as any)._carwowModelApplied = false;
          return;
        }

        // Handle special case for Land Rover -> land-rover (URL slug conversion)
        let makeForCheckbox = params.make.toLowerCase();
        if (params.make.toLowerCase() === "land rover") {
          makeForCheckbox = "land-rover";
        }

        // Select the make checkbox - with error handling
        try {
          const makeCheckbox = await page.$(
            `input[type="checkbox"][name="brand_slugs[]"][value*="${makeForCheckbox}"]`
          );
          if (makeCheckbox && (await makeCheckbox.isVisible())) {
            await makeCheckbox.check();
          } else {
            stagehand.log({
              category: "warn",
              message: `Make checkbox for ${params.make} not found or not visible`,
            });
            (page as any)._carwowModelApplied = false;
            return;
          }
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not select make: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
          (page as any)._carwowModelApplied = false;
          return;
        }

        // Wait for Model filter to become available
        try {
          await page.waitForSelector(
            'button.chip:has(span:has-text("Model"))',
            { timeout: 10000 }
          );
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: "Model filter button not found within timeout",
          });
          (page as any)._carwowModelApplied = false;
          return;
        }

        // STEP 3: Open Model filter dropdown
        await page.click(
          'button.chip[data-selling--filters-search-target="button"]:has-text("Model")'
        );
        await page.waitForTimeout(1000);

        // Check if this is a series model that needs special handling
        // Series models contain multiple comma-separated values (e.g., "1 Series, 2 Series, 3 Series")
        const modelGroup =
          modelGroupMap[params.make]?.[params.model] || params.model;

        if (modelGroup.includes(",")) {
          // SERIES MODEL HANDLING: Skip search box and go straight to checkbox selection
          console.log(`Skipping search box for series model: ${params.model}`);
          console.log(`Will select models: ${modelGroup}`);
        } else {
          // INDIVIDUAL MODEL HANDLING: Use search box to find specific model
          await page.fill(
            'input[data-selling--filters-search-target="searchInput"][id="ranges-search"]',
            params.model
          );
          await page.waitForTimeout(1000);
        }

        // STEP 4: Handle model checkbox selection
        if (modelGroup.includes(",")) {
          // SERIES MODEL: Select multiple models from the series
          const models = modelGroup.split(",");
          console.log(
            `Selecting ${models.length} models for series: ${params.model}`
          );

          // Iterate through each model in the series and select their checkboxes
          for (const model of models) {
            const checkbox = page
              .locator(
                `input[type="checkbox"][name="ranges[]"][value="${model.trim()}"]`
              )
              .first();

            if (await checkbox.isVisible()) {
              await checkbox.check();
              console.log(`✅ Selected: ${model.trim()}`);
            } else {
              console.log(`⚠️ Checkbox not visible for: ${model.trim()}`);
            }
          }

          console.log(
            `✅ [Carwow] Series "${params.model}" filter applied successfully - selected ${models.length} models`
          );
          (page as any)._carwowModelApplied = true;
        } else {
          // INDIVIDUAL MODEL: Find and select the best matching model
          console.log(`Looking for model: ${params.model}`);

          // First, try to find an exact match
          let exactCheckbox = page
            .locator(
              `input[type="checkbox"][name="ranges[]"][value="${modelGroup}"]`
            )
            .first();

          // If exact match not found, look for partial matches
          if (!(await exactCheckbox.isVisible())) {
            console.log(
              `Exact match not found for "${modelGroup}", looking for partial matches...`
            );

            // Get all available model checkboxes to find alternatives
            const allModelCheckboxes = await page.$$(
              'input[type="checkbox"][name="ranges[]"]'
            );
            const availableModels = [];

            for (const checkbox of allModelCheckboxes) {
              const value = await checkbox.getAttribute("value");
              if (value) {
                availableModels.push(value);
              }
            }

            // Find models that contain our search term
            const matchingModels = availableModels.filter((model) =>
              model.toLowerCase().includes(modelGroup.toLowerCase())
            );

            if (matchingModels.length > 0) {
              console.log(
                `Found ${
                  matchingModels.length
                } partial matches: ${matchingModels.join(", ")}`
              );

              // Sort by relevance: exact matches first, then shortest matches (likely base models)
              const sortedMatches = matchingModels.sort((a, b) => {
                const aExact = a.toLowerCase() === modelGroup.toLowerCase();
                const bExact = b.toLowerCase() === modelGroup.toLowerCase();

                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                // If both are partial matches, prefer shorter names (likely base models)
                return a.length - b.length;
              });

              const bestMatch = sortedMatches[0];
              console.log(`Selecting best match: ${bestMatch}`);

              exactCheckbox = page
                .locator(
                  `input[type="checkbox"][name="ranges[]"][value="${bestMatch}"]`
                )
                .first();
            }
          }

          // Select the found model checkbox
          if (await exactCheckbox.isVisible()) {
            await exactCheckbox.check();
            console.log(
              `✅ [Carwow] Model "${params.model}" filter applied successfully`
            );
            (page as any)._carwowModelApplied = true;
          } else {
            console.log(
              `⚠️ [Carwow] Model "${params.model}" not available in filter options. Will return 0 results.`
            );
            (page as any)._carwowModelApplied = false;
            return;
          }
        }

        // Only click the Model button again if we used the search box (individual models)
        // Series models don't need this step since we selected them directly
        if (!modelGroup.includes(",")) {
          await page.waitForTimeout(1000);
          await page.click(
            'button.chip[data-selling--filters-search-target="button"]:has-text("Model")'
          );
        }

        // STEP 5: Apply Age filter (if specified)
        await page.waitForTimeout(1000);

        if (params.minAge || params.maxAge) {
          await page.click('button.chip:has-text("Age")');

          // Set minimum age if within valid range (0-20 years)
          if (params.minAge && params.minAge > 0 && params.minAge <= 20) {
            await page.selectOption(
              'select[data-selling--range-select-target="minRangeSelect"]',
              String(params.minAge)
            );
          }

          // Set maximum age if within valid range (0-20 years)
          if (params.maxAge && params.maxAge > 0 && params.maxAge <= 20) {
            await page.selectOption(
              'select[data-selling--range-select-target="maxRangeSelect"]',
              String(params.maxAge)
            );
          }
        }

        // STEP 6: Apply Mileage filter (if specified)
        if (params.minMileage || params.maxMileage) {
          await page.click(
            'button.chip:has(span.chip__label:has-text("Mileage"))'
          );

          // Helper function to round mileage to nearest 10,000-mile step
          // Carwow only accepts specific mileage increments
          function roundToMileageStep(value: number) {
            return Math.floor(value / 10000) * 10000;
          }

          // Wait for the min and max mileage selectors to be visible
          await page.waitForSelector(
            'select[name="mileage[]"][data-selling--range-select-target="minRangeSelect"]'
          );
          await page.waitForSelector(
            'select[name="mileage[]"][data-selling--range-select-target="maxRangeSelect"]'
          );

          // Select minimum mileage if defined (10,000 - 200,000 miles)
          if (params.minMileage) {
            const min = roundToMileageStep(params.minMileage);
            if (min >= 10000 && min <= 200000) {
              await page.selectOption(
                'select[name="mileage[]"][data-selling--range-select-target="minRangeSelect"]',
                { value: String(min) }
              );
            }
          }

          // Select maximum mileage if defined (10,000 - 200,000 miles)
          if (params.maxMileage) {
            const max = roundToMileageStep(params.maxMileage);
            if (max >= 10000 && max <= 200000) {
              await page.selectOption(
                'select[name="mileage[]"][data-selling--range-select-target="maxRangeSelect"]',
                { value: String(max) }
              );
            }
          }
        }

        // Wait for filters to be applied and page to stabilize
        await page.waitForTimeout(2000);
        await page.waitForLoadState("networkidle");

        // STEP 7: Trigger lazy loading by scrolling down gradually
        // This ensures all car listings are loaded before extraction
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200;

            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight - window.innerHeight) {
                clearInterval(timer);
                setTimeout(resolve, 1000); // Extra wait after reaching bottom
              }
            }, 500);
          });
        });

        // Final wait for all content to load
        await page.waitForLoadState("networkidle");
        await page.waitForLoadState("domcontentloaded");

        // Final success state
        (page as any)._carwowModelApplied = true;

        stagehand.log({
          category: "debug",
          message: "Filters applied successfully for Carwow",
        });
      } catch (error) {
        // Log the error but don't throw - set a flag instead
        stagehand.log({
          category: "error",
          message: `Error applying filters for Carwow: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });

        // Set flag to indicate filtering failed, but don't crash
        (page as any)._carwowModelApplied = false;

        // Log that we're continuing without filters
        stagehand.log({
          category: "warn",
          message: "Continuing Carwow processing without filters due to error",
        });
      }
    },

    /**
     * EXTRACT CARS FUNCTION
     * Extracts car data from the filtered search results page
     * Parses individual car cards to extract details like price, title, location, etc.
     * Returns an array of car objects with standardized data structure
     */
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting extraction for Carwow",
      });

      // Check if model filter was applied successfully
      // If not, return empty array gracefully instead of failing
      if ((page as any)._carwowModelApplied === false) {
        stagehand.log({
          category: "warn",
          message:
            "Search was not executed due to unavailable model. Returning 0 results gracefully.",
        });
        return [];
      }

      // Find all car listing cards on the page
      const cards = await page.$$(
        'div.listings__list-item[data-listings-target="listing"]'
      );
      const carData = [];

      // Iterate through each car card and extract relevant information
      for (const card of cards) {
        try {
          // Extract car URL from the card link
          const url = await card.$eval("a.listing-card-component", (a: any) =>
            a.getAttribute("href")
          );

          // Extract car image URL (with fallback to empty string if not found)
          let imageUrl = "";
          try {
            imageUrl = await card.$eval(
              ".swiper-slide img",
              (img: any) => img.src
            );
          } catch {
            // imageUrl remains "" if image extraction fails
          }

          // Extract car title/name
          const title = await card.$eval(
            ".listing-card-component__make_and_model",
            (el: any) => el.textContent?.trim() || ""
          );

          // Extract car price
          const price = await card.$eval(
            ".listing-card-price-component__price",
            (el: any) => el.textContent?.trim() || ""
          );

          // Extract registration number (clean up multi-line text)
          const regRaw = await card.$eval(
            ".listing-card-license-plate-component__value",
            (el: any) => el.textContent?.trim() || ""
          );
          const reg = regRaw.split("\n")[0].trim();

          // Extract dealer location/delivery distance
          const location = await card.$eval(
            ".listing-card-distance-component__value",
            (el: any) => el.textContent?.trim() || ""
          );

          // Create standardized car object and add to results array
          carData.push({
            url: url?.startsWith("/")
              ? `https://dealers.carwow.co.uk${url}`
              : url,
            imageUrl,
            title,
            price: price,
            location,
            registration: reg,
            source: "CarWow",
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
