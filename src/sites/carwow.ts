// Carwow site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.js";
import { modelGroupMap } from "./carwow/model-groups.js";

export function carwowConfig(stagehand: any): SiteConfig {
  return {
    name: "carwow",
    baseUrl: "https://dealers.carwow.co.uk",
    loginUrl:
      "https://auth.carwow.co.uk/u/login?state=hKFo2SB6SjR1UFZkeHBMcUhfc0h5SS15Z0p0ZktYbmxPUVV4WaFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIGxITkZHM2tTM0l4RGRFQVhJSVpKWjFaQ25xM1pmNEJHo2NpZNkgSVNLd0IxcGJMSjl1UVVoRnkwdFhPYzc2aDJwdUthUlM",
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        await page.goto(
          "https://auth.carwow.co.uk/u/login?state=hKFo2SB6SjR1UFZkeHBMcUhfc0h5SS15Z0p0ZktYbmxPUVV4WaFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIGxITkZHM2tTM0l4RGRFQVhJSVpKWjFaQ25xM1pmNEJHo2NpZNkgSVNLd0IxcGJMSjl1UVVoRnkwdFhPYzc2aDJwdUthUlM"
        );
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });
        await page.fill("#username", credentials.username);
        await page.fill("#password", credentials.password);
        await page.getByRole("button", { name: "Continue" }).click();
        await page.waitForTimeout(2000);

        stagehand.log({
          category: "debug",
          message: "Login completed successfully",
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
    applyFilters: async (page: any, params: SearchParams) => {
      try {
        stagehand.log({
          category: "debug",
          message: "Filtering Carwow",
        });

        await page.waitForLoadState("domcontentloaded");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        await page.click(
          'label[for="filters-modal-desktop-listing_type__all"]'
        );
        await page.waitForTimeout(1000);

        await page.getByRole("button", { name: "Make" }).click();

        await page.waitForTimeout(1000);
        await page.fill(
          'input[data-selling--filters-search-target="searchInput"][id="brand_slugs-search"]',
          params.make
        );
        await page.waitForTimeout(1000);

        await page.check(
          `input[type="checkbox"][name="brand_slugs[]"][value*="${params.make.toLocaleLowerCase()}"]`
        );

        await page.waitForSelector('button.chip:has(span:has-text("Model"))');

        await page.click(
          'button.chip[data-selling--filters-search-target="button"]:has-text("Model")'
        );
        await page.waitForTimeout(1000);

        // Check if this is a series model that needs special handling
        const modelGroup =
          modelGroupMap[params.make]?.[params.model] || params.model;

        if (modelGroup.includes(",")) {
          // Skip the search box for series - go straight to checkbox selection
          console.log(`Skipping search box for series model: ${params.model}`);
          console.log(`Will select models: ${modelGroup}`);
        } else {
          // Use search box for individual models
          await page.fill(
            'input[data-selling--filters-search-target="searchInput"][id="ranges-search"]',
            params.model
          );
          await page.waitForTimeout(1000);
        }

        // Now handle the checkbox selection
        if (modelGroup.includes(",")) {
          // Handle multiple models (series)
          const models = modelGroup.split(",");
          console.log(
            `Selecting ${models.length} models for series: ${params.model}`
          );

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
          // Handle single model
          const checkbox = page
            .locator(
              `input[type="checkbox"][name="ranges[]"][value="${modelGroup}"]`
            )
            .first();

          if (await checkbox.isVisible()) {
            await checkbox.check();
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
        if (!modelGroup.includes(",")) {
          await page.waitForTimeout(1000);
          await page.click(
            'button.chip[data-selling--filters-search-target="button"]:has-text("Model")'
          );
        }

        //Select Age
        await page.waitForTimeout(1000);

        if (params.minAge || params.maxAge) {
          await page.click('button.chip:has-text("Age")');

          // Set min age if within valid range
          if (params.minAge && params.minAge > 0 && params.minAge <= 20) {
            await page.selectOption(
              'select[data-selling--range-select-target="minRangeSelect"]',
              String(params.minAge)
            );
          }

          // Set max age if within valid range
          if (params.maxAge && params.maxAge > 0 && params.maxAge <= 20) {
            await page.selectOption(
              'select[data-selling--range-select-target="maxRangeSelect"]',
              String(params.maxAge)
            );
          }
        }

        //Select Mileage
        if (params.minMileage || params.maxMileage) {
          await page.click(
            'button.chip:has(span.chip__label:has-text("Mileage"))'
          );
          // Round down to nearest valid 10,000-mile step
          function roundToMileageStep(value: number) {
            return Math.floor(value / 10000) * 10000;
          }

          // Wait for the min and max selects to be visible
          await page.waitForSelector(
            'select[name="mileage[]"][data-selling--range-select-target="minRangeSelect"]'
          );
          await page.waitForSelector(
            'select[name="mileage[]"][data-selling--range-select-target="maxRangeSelect"]'
          );

          // Select min mileage if defined
          if (params.minMileage) {
            const min = roundToMileageStep(params.minMileage);
            if (min >= 10000 && min <= 200000) {
              await page.selectOption(
                'select[name="mileage[]"][data-selling--range-select-target="minRangeSelect"]',
                { value: String(min) }
              );
            }
          }

          // Select max mileage if defined
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

        await page.waitForTimeout(2000);
        await page.waitForLoadState("networkidle");

        // Scroll down gradually to trigger lazy loading
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

        await page.waitForLoadState("networkidle");
        await page.waitForLoadState("domcontentloaded");

        stagehand.log({
          category: "debug",
          message: "Filters applied successfully for Carwow",
        });
      } catch (error) {
        stagehand.log({
          category: "error",
          message: `Error applying filters for Carwow: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        throw error;
      }
    },
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting extraction for Carwow",
      });

      // Check if model filter was applied successfully
      if ((page as any)._carwowModelApplied === false) {
        stagehand.log({
          category: "warn",
          message:
            "Search was not executed due to unavailable model. Returning 0 results gracefully.",
        });
        return [];
      }

      const cards = await page.$$(
        'div.listings__list-item[data-listings-target="listing"]'
      );
      const carData = [];

      for (const card of cards) {
        try {
          // URL
          const url = await card.$eval("a.card-generic__body", (a: any) =>
            a.getAttribute("href")
          );
          // Image
          let imageUrl = "";
          try {
            imageUrl = await card.$eval(
              '.media-slider__slide[data-number="1"] img.media-slider__image',
              (img: any) => img.src
            );
          } catch {
            // imageUrl remains ""
          }
          // Title
          const title = await card.$eval(
            ".card-generic__title",
            (el: any) => el.textContent?.trim() || ""
          );
          // Price
          const price = await card.$eval(
            ".card-listing-details__price.as-h4",
            (el: any) => el.textContent?.trim() || ""
          );
          // Reg
          const regRaw = await card.$eval(
            ".number-plate.number-plate--medium",
            (el: any) => el.textContent?.trim() || ""
          );
          const reg = regRaw.split("\n")[0].trim();
          // Location
          const location = await card.$eval(
            ".card-auction__car-delivery-distance",
            (el: any) => el.textContent?.trim() || ""
          );

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
