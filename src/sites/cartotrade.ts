// CarToTrade site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";

/**
 * CarToTrade Site Configuration
 * This function returns a complete site configuration object for the CarToTrade car dealership website
 * It handles authentication, filtering using noUiSlider components, and data extraction
 * CarToTrade uses a unique filtering system with sliders and dropdowns
 */
export function cartotradeConfig(stagehand: any): SiteConfig {
  return {
    name: "CarToTrade",
    baseUrl: "https://www.cartotrade.co.uk",
    loginUrl:
      "https://www.cartotrade.com/Account/Login?ReturnUrl=%2FHome%2FVehiclesOffered",
    shouldNavigateToSearchUrl: false,

    /**
     * LOGIN FUNCTION
     * Handles user authentication to the CarToTrade website
     * Navigates to login page, fills credentials, and completes the login process
     * Includes a post-login step to select a specific user account
     */
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to the CarToTrade login page
        await page.goto(
          "https://www.cartotrade.com/Account/Login?ReturnUrl=%2FHome%2FVehiclesOffered"
        );
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);

        // Log current URL for debugging purposes
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        // Fill in username and password fields
        await page.fill("#Username", credentials.username);
        await page.fill("#Password", credentials.password);

        // Click the login button to authenticate
        await page.click('button:has-text("Login")');

        // Wait for login to complete and page to load
        await page.waitForLoadState("networkidle");

        // Post-login step: Select specific user account (Ian Grosskopf)
        // This appears to be a required step for this particular CarToTrade setup
        await page.click('a.user-select:has-text("Ian Grosskopf")');
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
     * Uses CarToTrade's noUiSlider components for price, mileage, and age ranges
     * Handles make selection via checkboxes and model selection via dropdowns
     */
    applyFilters: async (page: any, params: SearchParams) => {
      stagehand.log({
        category: "debug",
        message: `Starting filter application for ${params.make} ${params.model}`,
      });

      // STEP 1: Apply Make filter using checkbox selection
      const make = params.make.toUpperCase();

      // Find the checkbox corresponding to the make (using contains for partial matching)
      // CarToTrade uses a complex structure with hidden inputs and checkboxes
      const checkbox = page.locator(
        `xpath=//input[@type="hidden" and contains(@id, "capMan_name") and contains(@value, "${make}")]/parent::li//input[@type="checkbox"]`
      );

      // Click the checkbox to select the make
      await checkbox.check();

      await page.waitForTimeout(1000);

      // STEP 2: Apply Price range filter using noUiSlider
      const sliderSelector = "#range-noui-slider-price";

      const minPrice = params.minPrice || 0;
      const maxPrice = params.maxPrice || 100000;

      // Use JavaScript evaluation to interact with the noUiSlider component
      // noUiSlider is a third-party library that provides range slider functionality
      await page.evaluate(
        ({
          selector,
          minPrice,
          maxPrice,
        }: {
          selector: any;
          minPrice: number;
          maxPrice: number;
        }) => {
          const el = document.querySelector(selector);
          if (el && el.noUiSlider) {
            el.noUiSlider.set([minPrice, maxPrice]);
          } else {
            console.error("noUiSlider API not found on", selector);
          }
        },
        { selector: sliderSelector, minPrice, maxPrice } // pass as a single object
      );

      // STEP 3: Apply Mileage range filter using noUiSlider
      const mileageSliderSelector = "#range-noui-slider-mileage";

      const minMileage = params.minMileage || 0;
      const maxMileage = params.maxMileage || 100000;

      await page.evaluate(
        ({
          selector,
          minMileage,
          maxMileage,
        }: {
          selector: any;
          minMileage: number;
          maxMileage: number;
        }) => {
          const el = document.querySelector(selector);
          if (el && el.noUiSlider) {
            el.noUiSlider.set([minMileage, maxMileage]);
          } else {
            console.error("noUiSlider API not found on", selector);
          }
        },
        { selector: mileageSliderSelector, minMileage, maxMileage } // pass as a single object
      );

      // STEP 4: Apply Age range filter using noUiSlider
      const ageSliderSelector = "#range-noui-slider-age";

      const minAge = params.minAge || 0;
      const maxAge = params.maxAge || 25;

      await page.evaluate(
        ({
          selector,
          minAge,
          maxAge,
        }: {
          selector: any;
          minAge: number;
          maxAge: number;
        }) => {
          const el = document.querySelector(selector);
          if (el && el.noUiSlider) {
            el.noUiSlider.set([minAge, maxAge]);
          } else {
            console.error("noUiSlider API not found on", selector);
          }
        },
        { selector: ageSliderSelector, minAge, maxAge } // pass as a single object
      );

      // STEP 5: Execute initial search with basic filters
      await page.click('button:has-text("Search")');

      await page.waitForTimeout(3000);
      await page.waitForLoadState("domcontentloaded");

      // STEP 6: Apply advanced filters (model and color) if specified
      // Only apply model filter if a model was provided and is not empty
      if (
        (params.model &&
          params.model.trim() &&
          params.model !== undefined &&
          params.model !== null) ||
        params.color
      ) {
        // Open the refine panel for additional filtering options
        await page.click("#toggleRefine");

        // Apply model filter if specified
        if (
          params.model &&
          params.model.trim() &&
          params.model !== undefined &&
          params.model !== null
        ) {
          await page.waitForTimeout(1000);

          // Open the vehicle range dropdown
          await page.click("#vehicleRangeId");

          await page.waitForTimeout(500);

          // Get all options from the select dropdown
          const options = await page.$$eval(
            "#vehicleRangeId option",
            (opts: any) =>
              opts.map((opt: any) => ({
                value: opt.value,
                text: opt.textContent?.trim(),
              }))
          );

          // Find the option whose text includes the model name (case-insensitive)
          // This allows for partial matching of model names
          const match = options.find(
            (opt: { value: string; text?: string | null }) =>
              opt.text &&
              opt.text.toUpperCase().includes(params.model.toUpperCase())
          );

          if (match) {
            // Select the matching model option
            await page.selectOption("#vehicleRangeId", { value: match.value });
            console.log(`Applied model filter: ${params.model}`);
          } else {
            console.log(
              `⚠️ [CartoTrade] Model "${params.model}" not available in filter options. Will return 0 results.`
            );
            // Mark that search was not executed so extraction returns 0 results
            (page as any)._cartotradeSearchExecuted = false;
            return;
          }
        }

        // Apply color filter if specified
        if ("color" in params) {
          await page.fill("#keyWordSearch", params.color ?? "");
        }

        await page.waitForTimeout(1000);

        // Execute the refined search with additional filters
        await page
          .locator("button.btnSubmit.radius.expand", { hasText: "Search" })
          .nth(0)
          .click();

        // Mark that search was executed successfully
        (page as any)._cartotradeSearchExecuted = true;
      } else {
        console.log(
          "Skipping model filter - no model specified or model is empty"
        );
        // Mark that no search was executed
        (page as any)._cartotradeSearchExecuted = false;
      }

      // Log the final URL after filtering for debugging
      const currentUrl = page.url();
      stagehand.log({
        category: "debug",
        message: `Current URL after filtering: ${currentUrl}`,
      });
    },

    /**
     * EXTRACT CARS FUNCTION
     * Extracts car data from the filtered search results page
     * Parses individual car cards to extract details like price, title, location, etc.
     * Handles cases where model filters may not have been applied successfully
     */
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting manual extraction process. Looping through cards",
      });

      // Check if search was executed (model filter might have failed)
      // If not, return empty array gracefully instead of failing
      if ((page as any)._cartotradeSearchExecuted === false) {
        console.log(
          "⚠️ [CartoTrade] Search was not executed due to unavailable model. Returning 0 results gracefully."
        );
        return [];
      }

      // Find all car listing cards on the page
      const cards = await page.$$(".panel");
      const carData = [];

      // Iterate through each car card and extract relevant information
      for (const card of cards) {
        try {
          // Check for the required anchor before extracting
          // Skip cards that don't have the expected structure
          const linkHandle = await card.$("h2.title a");
          if (!linkHandle) {
            console.warn("Skipping card: no h2.title a found");
            continue;
          }

          // Extract car URL from the card link
          const urlRaw = await card.$eval("h2.title a", (a: any) =>
            a.getAttribute("href")
          );
          const url = urlRaw ? urlRaw.trim() : urlRaw;

          // Extract car image URL with fallback handling
          // CarToTrade sometimes shows "no images yet" message instead of actual images
          const imageUrl = await card.evaluate((card: any) => {
            const img = card.querySelector("img");
            const noImages = card.querySelector("h1[style*='color: white;']");

            if (img) {
              return img.getAttribute("src")?.trim() || "";
            } else if (
              noImages &&
              noImages.textContent?.trim() === "no images yet"
            ) {
              return ""; // Return empty string when no images are available
            }
            return "";
          });

          // Extract car title/name
          const title = await card.$eval(
            "h2.title a",
            (el: any) => el.textContent?.trim().replace(/\s+/g, " ") || ""
          );

          // Extract car price with fallback handling
          // CarToTrade has different price element structures
          let price = await card
            .$eval(".column.medium-2 span.bold", (el: any) =>
              el.textContent?.trim()
            )
            .catch(async () => {
              return await card
                .$eval(".column.medium-2", (el: any) => el.textContent?.trim())
                .catch(() => "");
            });

          // Extract dealer location
          const location = await card
            .$eval("dd.bold span", (el: any) => el.textContent?.trim())
            .catch(() => "");

          // Extract registration number from hidden input field
          const reg = await card
            .$eval('input[name="vrmReg"]', (el: any) =>
              el.getAttribute("value")
            )
            .catch(() => "");

          // Extract mileage from the inline list (looks for text ending with "miles")
          const mileage = await card
            .$eval(
              ".inline-list.no-space-below.strong.lowercase.pipe-seperated.pull-left li:has-text('miles')",
              (el: any) => el.textContent?.trim() || ""
            )
            .catch(() => "");

          // Create standardized car object and add to results array
          carData.push({
            url: url?.startsWith("/")
              ? `https://www.cartotrade.com${url}`
              : url,
            imageUrl,
            title,
            price: price,
            location,
            registration: reg,
            mileage,
            source: "CarToTrade",
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          // Log warning and continue with next card if extraction fails for one
          console.warn(
            "Skipping a card due to missing or malformed elements:",
            err
          );
        }
      }

      // Return the extracted car data array
      return carData;
    },
  };
}
