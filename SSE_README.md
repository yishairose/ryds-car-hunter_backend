# Car Scraper with Server-Sent Events (SSE)

This implementation adds real-time streaming capabilities to the car scraper using Server-Sent Events (SSE). Results are now streamed to the frontend as they become available, rather than waiting for all sites to complete.

## What Changed

### 1. Modified `scrapeAllSites` Function

- Added optional `onProgress` callback parameter
- Progress events are emitted whenever cars are extracted from a site
- Real-time tracking of which sites have completed

### 2. New SSE Endpoint

- **Endpoint**: `POST /api/scrape-stream`
- **Content-Type**: `text/event-stream`
- **Features**: Real-time streaming of car extraction results

### 3. Event Types

#### Connection Event

```json
{
  "type": "connected",
  "message": "SSE connection established"
}
```

#### Progress Event

```json
{
  "type": "progress",
  "siteName": "bca",
  "cars": [...],
  "totalSites": 2,
  "currentSite": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Completion Event

```json
{
  "type": "complete",
  "totalCars": 150,
  "results": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Event

```json
{
  "type": "error",
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage

### Frontend Implementation

The demo HTML file shows how to consume the SSE endpoint:

```javascript
fetch("/api/scrape-stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    // Your search parameters here
    make: "BMW",
    model: "X5",
    year: "2020",
  }),
}).then((response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  function readStream() {
    reader.read().then(({ done, value }) => {
      if (done) return;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      lines.forEach((line) => {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          handleSSEMessage(data);
        }
      });

      readStream();
    });
  }

  readStream();
});
```

### Backward Compatibility

The original `POST /api/scrape` endpoint remains unchanged for backward compatibility.

## Benefits

1. **Real-time Updates**: Users see results as they're extracted, not just at the end
2. **Better UX**: Progress indicators and live updates improve user experience
3. **Efficient**: No need to wait for all sites to complete before showing results
4. **Scalable**: Works well with multiple sites and large result sets

## Demo

Open `demo.html` in your browser to see the SSE implementation in action. The demo includes:

- Real-time progress tracking
- Live car results display
- Site-by-site result organization
- Error handling and status updates

## Technical Notes

- Uses Node.js streams for efficient data transmission
- Proper SSE headers for browser compatibility
- Error handling for both individual site failures and connection issues
- Progress tracking with site completion status
