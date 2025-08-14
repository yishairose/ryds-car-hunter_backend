// CarToTrade site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";

export function cartotradeConfig(stagehand: any): SiteConfig {
  return {
    name: "CarToTrade",
    baseUrl: "https://www.cartotrade.co.uk",
    loginUrl:
      "https://www.cartotrade.com/Account/Login?ReturnUrl=%2FHome%2FVehiclesOffered",
    shouldNavigateToSearchUrl: false,
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        await page.goto(
          "https://www.cartotrade.com/Account/Login?ReturnUrl=%2FHome%2FVehiclesOffered"
        );
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });
        await page.fill("#Username", credentials.username);
        await page.fill("#Password", credentials.password);
        await page.click('button:has-text("Login")');

        await page.waitForLoadState("networkidle");

        await page.click('a.user-select:has-text("Ian Grosskopf")');
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
    applyFilters: async (page: any, params: SearchParams) => {
      stagehand.log({
        category: "debug",
        message: `Starting filter application for ${params.make} ${params.model}`,
      });

      const make = params.make.toUpperCase();

      // Find the checkbox corresponding to the make (using contains for partial matching)
      const checkbox = page.locator(
        `xpath=//input[@type="hidden" and contains(@id, "capMan_name") and contains(@value, "${make}")]/parent::li//input[@type="checkbox"]`
      );

      // Click the checkbox
      await checkbox.check();

      await page.waitForTimeout(1000);

      //Price range slider adjustment
      const sliderSelector = "#range-noui-slider-price";

      const minPrice = params.minPrice || 0;
      const maxPrice = params.maxPrice || 100000;

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

      //Mileage range slider adjustment
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

      // Age range slider adjustment
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

      await page.click('button:has-text("Search")');

      await page.waitForTimeout(3000);
      await page.waitForLoadState("domcontentloaded");

      // Only apply model filter if a model was provided and is not empty
      if (
        (params.model &&
          params.model.trim() &&
          params.model !== undefined &&
          params.model !== null) ||
        params.color
      ) {
        await page.click("#toggleRefine");

        if (
          params.model &&
          params.model.trim() &&
          params.model !== undefined &&
          params.model !== null
        ) {
          await page.waitForTimeout(1000);
          await page.click("#vehicleRangeId");

          await page.waitForTimeout(500);

          // Get all options from the select
          const options = await page.$$eval(
            "#vehicleRangeId option",
            (opts: any) =>
              opts.map((opt: any) => ({
                value: opt.value,
                text: opt.textContent?.trim(),
              }))
          );

          // Find the option whose text includes the model name (case-insensitive)
          const match = options.find(
            (opt: { value: string; text?: string | null }) =>
              opt.text &&
              opt.text.toUpperCase().includes(params.model.toUpperCase())
          );

          if (match) {
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

        if ("color" in params) {
          await page.fill("#keyWordSearch", params.color ?? "");
        }

        await page.waitForTimeout(1000);

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

      const currentUrl = page.url();
      stagehand.log({
        category: "debug",
        message: `Current URL after filtering: ${currentUrl}`,
      });
    },
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting manual extraction process. Looping through cards",
      });

      // Check if search was executed (model filter might have failed)
      if ((page as any)._cartotradeSearchExecuted === false) {
        console.log(
          "⚠️ [CartoTrade] Search was not executed due to unavailable model. Returning 0 results gracefully."
        );
        return [];
      }

      const cards = await page.$$(".panel");
      const carData = [];

      for (const card of cards) {
        try {
          // Check for the required anchor before extracting
          const linkHandle = await card.$("h2.title a");
          if (!linkHandle) {
            console.warn("Skipping card: no h2.title a found");
            continue;
          }
          const urlRaw = await card.$eval("h2.title a", (a: any) =>
            a.getAttribute("href")
          );
          const url = urlRaw ? urlRaw.trim() : urlRaw;

          // Try to get image URL or handle "no images yet" message
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

          const title = await card.$eval(
            "h2.title a",
            (el: any) => el.textContent?.trim().replace(/\s+/g, " ") || ""
          );

          let price = await card
            .$eval(".column.medium-2 span.bold", (el: any) =>
              el.textContent?.trim()
            )
            .catch(async () => {
              return await card
                .$eval(".column.medium-2", (el: any) => el.textContent?.trim())
                .catch(() => "");
            });

          const location = await card
            .$eval("dd.bold span", (el: any) => el.textContent?.trim())
            .catch(() => "");

          const reg = await card
            .$eval('input[name="vrmReg"]', (el: any) =>
              el.getAttribute("value")
            )
            .catch(() => "");

          carData.push({
            url: url?.startsWith("/")
              ? `https://www.cartotrade.com${url}`
              : url,
            imageUrl,
            title,
            price: price,
            location,
            registration: reg,
            source: "CarToTrade",
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.warn(
            "Skipping a card due to missing or malformed elements:",
            err
          );
        }
      }

      return carData;
    },
  };
}
