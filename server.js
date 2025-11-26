require('dotenv').config();

const express = require('express');
const { scrapeHoldingsData } = require('./scraper');

const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'fund-scraper-server'
  });
});

// Scraping endpoint with API key authentication
app.post('/scrape', async (req, res) => {
  try {
    // Verify API key
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_KEY;

    if (!expectedApiKey) {
      console.warn('WARNING: API_KEY not set in environment variables');
    } else if (apiKey !== expectedApiKey) {
      console.log('Unauthorized request - invalid API key');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`Scraping request received for: ${url}`);

    // Run the scraper
    const result = await scrapeHoldingsData(url);

    console.log(`Scraping completed successfully: ${result.fund_name}`);
    res.json(result);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to scrape data'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Fund scraper server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Key protection: ${process.env.API_KEY ? 'enabled' : 'DISABLED (WARNING)'}`);
  console.log(`Allowed origin: ${process.env.ALLOWED_ORIGIN || '*'}`);
});
