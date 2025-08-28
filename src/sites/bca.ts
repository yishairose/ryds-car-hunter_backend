// BCA site config for Stagehand car search
import type {
  SiteConfig,
  SearchParams,
  LoginCredentials,
} from "../../index.ts";
import { modelGroupMap } from "./bca/model-groups.js";

/**
 * BCA Site Configuration
 * This function returns a complete site configuration object for the BCA car auction website
 * It handles URL building, authentication, and data extraction for car searches
 * BCA uses a unique search query format with specific parameter mappings
 */
export function bcaConfig(stagehand: any): SiteConfig {
  return {
    name: "bca",
    baseUrl: "https://www.bca.co.uk",
    loginUrl:
      "https://login.bca.co.uk/login?signin=7d12c2d8683d1121f324c3ef7e44b042",

    /**
     * BUILD SEARCH URL FUNCTION
     * Constructs the search URL with BCA's specific query format
     * BCA uses a 'bq' parameter with pipe-separated filter values
     * Handles special cases like Mercedes-Benz mapping and age band conversion
     */
    buildSearchUrl: (params: SearchParams) => {
      // Map Mercedes to BCA's expected format (BCA uses "Mercedes-Benz" not "Mercedes")
      const makeMapping: Record<string, string> = {
        Mercedes: "Mercedes-Benz",
        "Mercedes-Benz": "Mercedes-Benz",
      };

      // Get the mapped make name, fallback to original if not found
      const mappedMake = makeMapping[params.make] || params.make;
      const modelGroup =
        modelGroupMap[mappedMake.toUpperCase()]?.[params.model] || params.model;

      // Build the BCA query string with pipe-separated filters
      const bqParts = [
        "VehicleType:Cars",
        `Make:${mappedMake.toUpperCase()}`,
        // ModelGroup must match BCA's dropdown exactly, e.g., 'Focus Range', not uppercased or altered
        `ModelGroup:${modelGroup}`,

        // Color filter (capitalize first letter to match BCA format)
        params.color
          ? `ColourGeneric:${
              params.color.charAt(0).toUpperCase() + params.color.slice(1)
            }`
          : undefined,

        // Price range filter (min, max, or both)
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

        // Mileage range filter (min, max, or both)
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

        // Car age filter - BCA uses specific age bands (e.g., Age:18MONTH..9YEAR)
        (() => {
          // Define BCA's age band format mapping
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

          // Helper function to find closest age band below the given years
          const closestLowerBand = (years: number) =>
            (
              ageBands
                .slice()
                .reverse()
                .find((b) => years >= b.years) || ageBands[0]
            ).label;

          // Helper function to find closest age band above the given years
          const closestUpperBand = (years: number) =>
            years > 10
              ? "99YEAR"
              : ageBands.find((b) => years <= b.years)?.label || "99YEAR";

          // Build age filter string based on min/max age parameters
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

        // VAT qualification filter
        params.vatQualifying ? "VATType:VAT Qualifying" : undefined,
      ].filter(Boolean); // Remove undefined values

      // Construct the final search URL with BCA's query format
      const searchParams = new URLSearchParams();
      searchParams.set("q", "");
      searchParams.set("bq", bqParts.join("|")); // Pipe-separated filter values
      return `https://www.bca.co.uk/search?${searchParams.toString()}`;
    },

    shouldNavigateToSearchUrl: true,

    /**
     * LOGIN FUNCTION
     * Handles user authentication to the BCA website
     * Navigates through the login process with detailed debugging
     * Handles cookie banners and multi-step authentication flow
     */
    login: async (page: any, credentials: LoginCredentials) => {
      try {
        // Navigate to the BCA login page
        await page.goto(
          "https://login.bca.co.uk/login?signin=7d12c2d8683d1121f324c3ef7e44b042"
        );
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3_000);

        // Log current URL for debugging purposes
        const currentUrl = page.url();
        stagehand.log({
          category: "debug",
          message: `Current URL: ${currentUrl}`,
        });

        // STEP 1: Fill in username field
        await page.fill("#usernameInput", credentials.username);
        await page.waitForTimeout(1000);

        // STEP 2: Handle cookie consent banners
        // Try common cookie accept buttons
        const cookieAccept = page.locator('button:has-text("Accept")');
        if (await cookieAccept.isVisible()) {
          await cookieAccept.first().click();
        }

        // Or for overlays that use different buttons
        const cookieReject = page.locator('button:has-text("Reject All")');
        if (await cookieReject.first().isVisible()) {
          await cookieReject.first().click();
        }

        // Click Continue button to proceed to password step
        await page.getByRole("button", { name: "Continue" }).click();

        // STEP 3: Wait for password form to load and fill password
        await page.waitForLoadState("domcontentloaded");
        await page.fill(
          "#password\\ form-control__input",
          credentials.password
        );
        await page.waitForTimeout(1000);

        // STEP 4: Click login button to complete authentication
        await page.click("#loginBtn");

        // Wait for the page to settle after login - use timeout instead of load state
        await page.waitForTimeout(5000);

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

    // BCA doesn't use client-side filtering - all filtering is done via URL parameters
    applyFilters: async () => {},

    /**
     * EXTRACT CARS FUNCTION
     * Extracts car data from BCA's search results using their API
     * Handles pagination to collect all available vehicles
     * BCA provides data via API calls rather than DOM scraping
     */
    extractCars: async (page: any) => {
      stagehand.log({
        category: "debug",
        message: "Starting manual extraction process with pagination",
      });

      // Get current URL and construct search URL for navigation
      const currentUrl = page.url();
      // Preserve the full URL including bq parameter for VAT filtering
      const searchUrl = currentUrl;

      await page.waitForTimeout(2000);

      // Navigate to the search page first if not already there
      if (currentUrl !== searchUrl) {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);
      }

      // Initialize variables for pagination handling
      let allVehicles: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      // Loop through all pages to collect complete vehicle data
      while (hasMorePages) {
        stagehand.log({
          category: "debug",
          message: `Fetching page ${currentPage}`,
        });

        // Wait for the API response for this page
        // BCA loads data via API calls to /search/api/search endpoint
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

        // Parse the API response data
        const data = await response.json();
        console.log(`Page ${currentPage}: ${data.items?.length || 0} items`);
        console.log(
          `Total results: ${data.totalResults || "unknown"}, Pages: ${
            data.numberOfPages || "unknown"
          }`
        );

        // Process vehicles from this page if available
        if (data?.items && data.items.length > 0) {
          const pageVehicles = data.items.map((vehicle: any) => {
            // Extract image URL from first image object if available
            let imageUrl = "";
            if (Array.isArray(vehicle.images) && vehicle.images.length > 0) {
              imageUrl = vehicle.images[0].imageURI || "";
            }

            // Build product page URL using BCA's URL format
            // BCA uses registration number to construct URLs: /lot/{first4}%20{last3}
            const vrm = vehicle.vrm || "";
            const mileage = vehicle.mileage || "";
            const regFirst4 = vrm.replace(/\s/g, "").substring(0, 4);
            const regLast3 = vrm.replace(/\s/g, "").slice(-3);
            const productPageUrl = `https://www.bca.co.uk/lot/${regFirst4}%20${regLast3}`;

            // Return standardized vehicle object
            return {
              url: productPageUrl,
              imageUrl,
              title: vehicle.primaryVehicleDescription || "",
              price: vehicle.capCleanPrice || "",
              location: vehicle.localSaleLocation || "",
              registration: vrm,
              source: "BCA",
              timestamp: new Date().toISOString(),
              mileage: mileage,
            };
          });

          // Add vehicles from this page to the total collection
          allVehicles = allVehicles.concat(pageVehicles);

          // Check if we have more pages to process
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

      // Log completion and return all collected vehicles
      stagehand.log({
        category: "debug",
        message: `Extraction complete. Total vehicles found: ${allVehicles.length}`,
      });

      return allVehicles;
    },
  };
}
