# 🚗 Car Dealership Scraper API

A powerful, multi-site car scraping API built with [Stagehand](https://github.com/browserbase/stagehand) and [Playwright](https://playwright.dev/). This API automatically scrapes car listings from multiple UK car dealership and auction websites, providing unified access to comprehensive vehicle data.

## 🌟 Features

- **Multi-Site Support**: Scrapes from 5 major UK car platforms
- **Real-Time Streaming**: Server-Sent Events (SSE) for live progress updates
- **Comprehensive Filtering**: Make, model, price, mileage, age, and color filters
- **Authentication Handling**: Automatic login management for all supported sites
- **Batch Processing**: Concurrent scraping with configurable concurrency limits
- **Standardized Output**: Consistent data format across all sites
- **Error Handling**: Graceful fallbacks and detailed error reporting

## 🏢 Supported Sites

| Site                 | Type       | Filtering        | Authentication |
| -------------------- | ---------- | ---------------- | -------------- |
| **BCA**              | Auction    | URL-based        | ✅ Required    |
| **CarToTrade**       | Dealership | UI-based         | ✅ Required    |
| **Motorway**         | Auction    | URL-based        | ✅ Required    |
| **Carwow**           | Dealership | UI-based         | ✅ Required    |
| **Disposal Network** | Auction    | Limited UI + API | ✅ Required    |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Valid credentials for supported sites

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd car-dealership-scraper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Configuration

Copy `.env.example` to `.env` and add your credentials:

```bash
# BCA (British Car Auctions)
BCA_USERNAME=your_username
BCA_PASSWORD=your_password

# CarToTrade
CARTOTRADE_USERNAME=your_username
CARTOTRADE_PASSWORD=your_password

# Motorway
MOTORWAY_USERNAME=your_username
MOTORWAY_PASSWORD=your_password

# Carwow
CARWOW_USERNAME=your_username
CARWOW_PASSWORD=your_password

# Disposal Network
DISPOSALNETWORK_USERNAME=your_username
DISPOSALNETWORK_PASSWORD=your_password
```

### Running the API

```bash
# Start the API server
npm start

# Or run directly
npm run dev
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

### POST `/api/scrape-stream`

Streaming endpoint for real-time car scraping with progress updates.

**Request Body:**

```json
{
  "make": "BMW",
  "model": "3 Series",
  "minPrice": 15000,
  "maxPrice": 30000,
  "minMileage": 50000,
  "maxMileage": 100000,
  "color": "Black",
  "minAge": 2,
  "maxAge": 5
}
```

**Response:** Server-Sent Events (SSE) stream with real-time updates

**Event Types:**

- `connected`: Initial connection established
- `progress`: Site-by-site scraping progress
- `complete`: Final results summary
- `error`: Error information if something goes wrong

### Example Usage

```javascript
// Client-side SSE consumption
const eventSource = new EventSource("/api/scrape-stream", {
  method: "POST",
  body: JSON.stringify({
    make: "BMW",
    model: "3 Series",
    minPrice: 15000,
    maxPrice: 30000,
  }),
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "connected":
      console.log("Connected to scraper");
      break;
    case "progress":
      console.log(`${data.siteName}: ${data.cars.length} cars found`);
      break;
    case "complete":
      console.log(`Total: ${data.totalCars} cars`);
      eventSource.close();
      break;
    case "error":
      console.error("Error:", data.error);
      eventSource.close();
      break;
  }
};
```

## 🔧 Configuration

### Stagehand Configuration

The scraper uses Stagehand for browser automation. Configuration is in `stagehand.config.ts`:

```typescript
export default {
  env: "LOCAL", // or "BROWSERBASE"
  modelName: "gpt-4o", // or "claude-3-5-sonnet-latest"
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY, // or ANTHROPIC_API_KEY
  },
};
```

### Concurrency Settings

Control how many sites are scraped simultaneously:

```typescript
// In index.ts, modify the batch size
const results = await runInBatches(
  siteConfigsArr.map((siteConfig) => () => processSite(siteConfig)),
  2 // Increase for more concurrent scraping
);
```

## 📊 Data Structure

### Search Parameters

```typescript
type SearchParams = {
  make: string; // Required: Vehicle make (e.g., "BMW")
  model: string; // Required: Vehicle model (e.g., "3 Series")
  minPrice?: number; // Optional: Minimum price
  maxPrice?: number; // Optional: Maximum price
  minMileage?: number; // Optional: Minimum mileage
  maxMileage?: number; // Optional: Maximum mileage
  color?: string; // Optional: Vehicle color
  minAge?: number; // Optional: Minimum age in years
  maxAge?: number; // Optional: Maximum age in years
};
```

### Car Data Output

```typescript
type CarData = {
  url: string; // Direct link to vehicle listing
  imageUrl: string; // Vehicle image URL
  title: string; // Vehicle title/description
  price: string; // Vehicle price
  location: string; // Dealer/auction location
  registration: string; // Vehicle registration number
  source: string; // Source site name
  timestamp: string; // ISO timestamp of extraction
};
```

## 🏗️ Architecture

### Core Components

1. **Site Configurations** (`src/sites/`): Individual site scrapers with specific logic
2. **Main Scraper** (`index.ts`): Orchestrates multi-site scraping
3. **API Server** (`api-server.ts`): Express server with SSE endpoints
4. **Type Definitions** (`src/types/`): TypeScript interfaces and types

### Scraping Flow

```
1. Initialize Stagehand browser automation
2. Load site configurations and credentials
3. Process sites in batches (concurrency: 2)
4. For each site:
   - Authenticate with credentials
   - Navigate to search page (if URL-based)
   - Apply filters (if UI-based)
   - Extract car data
   - Stream progress via SSE
5. Compile and return results
6. Clean up browser resources
```

### Site-Specific Implementations

#### BCA (British Car Auctions)

- **Filtering**: URL-based with complex query string construction
- **Data Source**: API responses captured during search
- **Special Features**: Age band conversion, Mercedes-Benz mapping

#### CarToTrade

- **Filtering**: UI-based with noUiSlider components
- **Data Source**: DOM scraping with fallback handling
- **Special Features**: Complex make/model selection logic

#### Motorway

- **Filtering**: URL-based with model mapping
- **Data Source**: DOM scraping with specific CSS selectors
- **Special Features**: Multiple model handling, URL parameter construction

#### Carwow

- **Filtering**: UI-based with dropdowns and checkboxes
- **Data Source**: DOM scraping with lazy loading
- **Special Features**: Series model handling, gradual scrolling

#### Disposal Network

- **Filtering**: Limited UI + client-side filtering
- **Data Source**: API responses with additional processing
- **Special Features**: Post-extraction filtering for price/mileage/age

## 🚨 Error Handling

The API implements comprehensive error handling:

- **Credential Validation**: Checks for missing or invalid credentials
- **Site Failures**: Continues processing other sites if one fails
- **Graceful Degradation**: Returns partial results if possible
- **Detailed Logging**: Comprehensive console output for debugging
- **SSE Error Events**: Real-time error reporting to clients

## 🔍 Debugging

### Console Output

The scraper provides detailed logging with emojis for easy identification:

- 🚀 Initialization and startup
- 🔑 Authentication processes
- 🌐 Site navigation and URL building
- 🔧 Filter application
- 📊 Data extraction progress
- ✅ Success confirmations
- ❌ Error reports
- 🧹 Cleanup operations

### Environment Variables

Enable debug logging by setting:

```bash
DEBUG=true
NODE_ENV=development
```

## 🚀 Deployment

### Local Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Browserbase Integration

For cloud-based browser automation:

1. Set `env: "BROWSERBASE"` in `stagehand.config.ts`
2. Add your Browserbase API key to `.env`
3. Deploy to your preferred hosting platform

## 🤝 Contributing

### Adding New Sites

1. Create a new site configuration in `src/sites/`
2. Implement the `SiteConfig` interface
3. Add credentials to environment variables
4. Update the main scraper configuration
5. Add comprehensive comments and documentation

### Code Style

- Use TypeScript for all new code
- Follow existing comment patterns
- Include error handling and logging
- Test with multiple filter combinations

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

1. **Authentication Failures**: Verify credentials in `.env`
2. **Site Changes**: Check if site selectors need updates
3. **Rate Limiting**: Reduce concurrency or add delays
4. **Browser Issues**: Update Playwright or check Stagehand compatibility

### Getting Help

- Check the console output for detailed error messages
- Review site-specific configurations in `src/sites/`
- Verify environment variables are properly set
- Check network connectivity and site availability

---

**Built with ❤️ using [Stagehand](https://github.com/browserbase/stagehand) and [Playwright](https://playwright.dev/)**
