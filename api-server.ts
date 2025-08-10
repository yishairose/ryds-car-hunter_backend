import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { scrapeAllSites } from "./index.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

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
