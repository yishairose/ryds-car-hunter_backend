import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { scrapeAllSites } from "./index.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// SSE endpoint for real-time car scraping
app.post("/api/scrape-stream", async (req: Request, res: Response) => {
  console.log("🚀 [API] SSE scraping request received");

  try {
    const params = req.body || {};
    console.log("📋 [API] Request parameters:", params);

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Send initial connection message with total sites count
    // Currently only motorway is enabled in the scraper
    const totalSites = 5;

    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        message: "SSE connection established",
        totalSites,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Progress callback to stream results as they come in
    const onProgress = (
      siteName: string,
      cars: any[],
      totalSites: number,
      currentSite: number
    ) => {
      console.log(
        `📊 [API] Progress from ${siteName}: ${cars.length} cars (site ${currentSite}/${totalSites})`
      );

      const progressData = {
        type: "progress",
        siteName,
        cars,
        totalSites,
        currentSite,
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      console.log(`📡 [API] Progress data sent via SSE for ${siteName}`);
    };

    // Start scraping with progress tracking
    console.log("🔍 [API] Starting scraping with progress tracking...");
    const results = await scrapeAllSites(params, onProgress);
    console.log(
      `✅ [API] Scraping completed with ${results.length} total cars`
    );

    // Send completion message
    const completionData = {
      type: "complete",
      totalCars: results.length,
      results,
      timestamp: new Date().toISOString(),
    };

    console.log("📡 [API] Sending completion data via SSE");
    res.write(`data: ${JSON.stringify(completionData)}\n\n`);
    res.end();
    console.log("🏁 [API] SSE stream completed successfully");
  } catch (err: any) {
    console.error("❌ [API] Scrape error:", err);

    // Send error via SSE
    console.log("📡 [API] Sending error data via SSE");
    const errorData = {
      type: "error",
      error: err.message,
      timestamp: new Date().toISOString(),
    };

    res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    res.end();
    console.log("🏁 [API] SSE error stream completed");
  }
});

// Keep the original endpoint for backward compatibility
app.post("/api/scrape", async (req: Request, res: Response) => {
  try {
    const params = req.body || {};
    const results = await scrapeAllSites(params);
    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error("Scrape error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
  console.log(`Scraper API running on port ${PORT}`);
});
