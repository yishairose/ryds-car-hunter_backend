// BCA site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.ts";
import { modelGroupMap } from "./bca/model-groups.js";

export function bcaConfig(stagehand: any): SiteConfig {
  return {
    name: "bca",
    baseUrl: "https://www.bca.co.uk",
    loginUrl:
      "https://login.bca.co.uk/login?signin=7d12c2d8683d1121f324c3ef7e44b042",
    buildSearchUrl: (params: SearchParams) => {
      // Map Mercedes to BCA's expected format
      const makeMapping: Record<string, string> = {
        Mercedes: "Mercedes-Benz",
        "Mercedes-Benz": "Mercedes-Benz",
      };

      // Get the mapped make name, fallback to original if not found
      const mappedMake = makeMapping[params.make] || params.make;
      const modelGroup =
        modelGroupMap[mappedMake.toUpperCase()]?.[params.model] || params.model;
      const bqParts = [
        "VehicleType:Cars",
        `Make:${mappedMake.toUpperCase()}`,
        // ModelGroup must match BCA's dropdown exactly, e.g., 'Focus Range', not uppercased or altered
        `ModelGroup:${modelGroup}`,
        params.color
          ? `ColourGeneric:${
              params.color.charAt(0).toUpperCase() + params.color.slice(1)
            }`
          : undefined,
        (() => {
          if (params.minPrice && params.maxPrice) {
            return `CapCleanPrice:${params.minPrice}..${params.maxPrice}`;
          }
          if (params.minPrice) {
            return `CapCleanPrice:${params.minPrice}..9000000`;
          }
          if (params.maxPrice) {
            return `CapCleanPrice:0..${params.maxPrice}`;
          }
          return undefined;
        })(),

        (() => {
          if (params.minMileage && params.maxMileage) {
            return `Mileage:${params.minMileage}..${params.maxMileage}`;
          }
          if (params.minMileage) {
            return `Mileage:${params.minMileage}..9000000`;
          }
          if (params.maxMileage) {
            return `Mileage:0..${params.maxMileage}`;
          }
          return undefined;
        })(),
        // Car age filter (e.g., Age:18MONTH..9YEAR)
        (() => {
          const ageBands = [
            { label: "0MONTH", years: 0 },
            { label: "12MONTH", years: 1 },
            { label: "2YEAR", years: 2 },
            { label: "3YEAR", years: 3 },
            { label: "4YEAR", years: 4 },
            { label: "5YEAR", years: 5 },
            { label: "6YEAR", years: 6 },
            { label: "7YEAR", years: 7 },
            { label: "8YEAR", years: 8 },
            { label: "9YEAR", years: 9 },
            { label: "10YEAR", years: 10 },
            { label: "99YEAR", years: 99 }, // 99YEAR for 10+ years
          ];
          const closestLowerBand = (years: number) =>
            (
              ageBands
                .slice()
                .reverse()
                .find((b) => years >= b.years) || ageBands[0]
            ).label;
          const closestUpperBand = (years: number) =>
            years > 10
              ? "99YEAR"
              : ageBands.find((b) => years <= b.years)?.label || "99YEAR";

          if (params.minAge !== undefined && params.maxAge !== undefined) {
            const minLabel = closestLowerBand(params.minAge);
            const maxLabel = closestUpperBand(params.maxAge);
            return `DateRegistered:${minLabel}..${maxLabel}`;
          }
          if (params.minAge !== undefined) {
            const minLabel = closestLowerBand(params.minAge);
            return `DateRegistered:${minLabel}..99YEAR`;
          }
          if (params.maxAge !== undefined) {
            const maxLabel = closestUpperBand(params.maxAge);
            return `DateRegistered:0MONTH..${maxLabel}`;
          }
          return undefined;
        })(),
      ].filter(Boolean);
      const searchParams = new URLSearchParams();
      searchParams.set("q", "");
      searchParams.set("bq", bqParts.join("|"));
      return `https://www.bca.co.uk/search?${searchParams.toString()}`;
    },
    shouldNavigateToSearchUrl: true,
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        await page.goto(
          "https://login.bca.co.uk/login?signin=7d12c2d8683d1121f324c3ef7e44b042"
        );
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3_000);
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        // Take screenshot after initial page load
        try {
          await page.screenshot({ path: "debug-bca-1-initial-page.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-1-initial-page.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

        //Login to BCA
        await page.fill("#usernameInput", credentials.username);
        await page.waitForTimeout(1000);

        // Take screenshot after filling username
        try {
          await page.screenshot({ path: "debug-bca-2-after-username.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-2-after-username.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

        // Try common cookie banners
        const cookieAccept = page.locator('button:has-text("Accept")');
        if (await cookieAccept.isVisible()) {
          await cookieAccept.first().click();
        }

        // Or for overlays that use different buttons
        const cookieReject = page.locator('button:has-text("Reject All")');
        if (await cookieReject.first().isVisible()) {
          await cookieReject.first().click();
        }
        await page.getByRole("button", { name: "Continue" }).click();

        // Take screenshot after clicking Continue
        try {
          await page.screenshot({ path: "debug-bca-3-after-continue.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-3-after-continue.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

        await page.waitForLoadState("domcontentloaded");
        await page.fill(
          "#password\\ form-control__input",
          credentials.password
        );
        await page.waitForTimeout(1000);

        // Take screenshot after filling password
        try {
          await page.screenshot({ path: "debug-bca-4-after-password.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-4-after-password.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

        await page.click("#loginBtn");

        // Take screenshot after clicking login button
        try {
          await page.screenshot({ path: "debug-bca-5-after-login-click.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-5-after-login-click.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

        // Wait for the page to settle after login - use timeout instead of load state
        await page.waitForTimeout(5000);

        // Take final screenshot after login completion
        try {
          await page.screenshot({ path: "debug-bca-6-login-complete.png" });
          stagehand.log({
            category: "debug",
            message: "Screenshot saved as debug-bca-6-login-complete.png",
          });
        } catch (error) {
          stagehand.log({
            category: "warn",
            message: `Could not take screenshot: ${error}`,
          });
        }

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
    applyFilters: async () => {},
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting manual extraction process with pagination",
      });

      const currentUrl = page.url();
      const searchUrl =
        "https://www.bca.co.uk/search?" + new URL(currentUrl).search;

      await page.waitForTimeout(2000);

      // Navigate to the search page first
      if (currentUrl !== searchUrl) {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
      }

      let allVehicles: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        stagehand.log({
          category: "debug",
          message: `Fetching page ${currentPage}`,
        });

        // Wait for the API response for this page
        const [response] = await Promise.all([
          page.waitForResponse(
            (resp: any) =>
              resp.url().includes("/search/api/search") && resp.status() === 200
          ),
          // Trigger the page load (either reload or navigate to next page)
          currentPage === 1
            ? page.reload({ waitUntil: "domcontentloaded" })
            : page.goto(searchUrl + `&page=${currentPage}`, {
                waitUntil: "domcontentloaded",
              }),
        ]);

        const data = await response.json();
        console.log(`Page ${currentPage}: ${data.items?.length || 0} items`);
        console.log(
          `Total results: ${data.totalResults || "unknown"}, Pages: ${
            data.numberOfPages || "unknown"
          }`
        );

        if (data?.items && data.items.length > 0) {
          const pageVehicles = data.items.map((vehicle: any) => {
            // Get imageUrl from first image object if available
            let imageUrl = "";
            if (Array.isArray(vehicle.images) && vehicle.images.length > 0) {
              imageUrl = vehicle.images[0].imageURI || "";
            }
            // Build productPageUrl
            const vrm = vehicle.vrm || "";
            const regFirst4 = vrm.replace(/\s/g, "").substring(0, 4);
            const regLast3 = vrm.replace(/\s/g, "").slice(-3);
            const productPageUrl = `https://www.bca.co.uk/lot/${regFirst4}%20${regLast3}`;
            return {
              url: productPageUrl,
              imageUrl,
              title: vehicle.primaryVehicleDescription || "",
              price: vehicle.capCleanPrice || "",
              location: vehicle.localSaleLocation || "",
              registration: vrm,
              source: "BCA",
              timestamp: new Date().toISOString(),
            };
          });

          allVehicles = allVehicles.concat(pageVehicles);

          // Check if we have more pages
          const totalPages = data.numberOfPages || 0;

          if (currentPage >= totalPages) {
            hasMorePages = false;
          } else {
            currentPage++;
            await page.waitForTimeout(1000); // Small delay between pages
          }
        } else {
          hasMorePages = false;
        }
      }

      stagehand.log({
        category: "debug",
        message: `Extraction complete. Total vehicles found: ${allVehicles.length}`,
      });

      return allVehicles;
    },
  };
}
