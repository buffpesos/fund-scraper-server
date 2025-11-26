# Fund Scraper Server

A dedicated scraping server for extracting mutual fund holdings data from ScanX Trade. This server runs Playwright to scrape fund data and saves it directly to Vercel Blob storage.

## Overview

This server provides a single endpoint that accepts a ScanX Trade URL, scrapes the fund holdings data (both shares and holdings percentage), and saves the combined data to Vercel Blob storage.

### Features

- 🚀 **Playwright-based scraping** with full browser automation
- 🔐 **API key authentication** for secure access
- 💾 **Direct Vercel Blob integration** for persistent storage
- 🐳 **Docker support** for easy deployment
- 🔄 **Health check endpoint** for monitoring
- 📊 **Comprehensive logging** for debugging

## Architecture

```
┌─────────────────┐
│  Vercel App     │  User submits URL
│  (Next.js)      │
└────────┬────────┘
         │
         │ POST /scrape { url }
         │ Header: X-API-Key
         │
         v
┌─────────────────┐
│  This Server    │  Runs Playwright
│  (Express)      │  Scrapes data
└────────┬────────┘
         │
         │ Saves JSON
         v
┌─────────────────┐
│  Vercel Blob    │  Persistent storage
│    Storage      │
└─────────────────┘
```

## Local Testing (Without Docker)

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd fund-scraper-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers**
   ```bash
   npx playwright install chromium
   ```

4. **Create environment file**
   ```bash
   cp .env.example .env
   ```

5. **Configure environment variables**

   Edit `.env` and add your values:
   ```bash
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # API Security
   API_KEY=test_api_key_123

   # CORS Configuration
   ALLOWED_ORIGIN=http://localhost:3000

   # Vercel Blob Storage
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXX_YYYYYYYY
   ```

   **Getting your Vercel Blob token:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project
   - Navigate to **Storage** → **Blob**
   - Copy the `BLOB_READ_WRITE_TOKEN`

### Running Locally

1. **Start the server**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

2. **Verify the server is running**
   ```bash
   curl http://localhost:3001/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-11-25T...",
     "service": "fund-scraper-server"
   }
   ```

### Testing the Scraper

Test scraping a fund using curl:

```bash
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test_api_key_123" \
  -d '{
    "url": "https://scanx.trade/insight/mf-holdings/parag-parikh-flexi-cap-fund-direct-growth-holdings"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "fund_name": "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
  "total_stocks": 35,
  "months_available": ["Nov 2024", "Oct 2024", ...],
  "filename": "parag-parikh-flexi-cap-fund-direct-growth-holdings.json",
  "blob_url": "https://...blob.vercel-storage.com/..."
}
```

### Viewing Logs

The server outputs detailed logs:

```
Fund scraper server running on port 3001
Health check: http://localhost:3001/health
Environment: development
API Key protection: enabled
Allowed origin: http://localhost:3000

Scraping request received for: https://scanx.trade/...
Navigating to the page...
Extracting SHARES data...
Found 35 rows in SHARES view
Switching to Holdings% view...
Clicked "Shares" button to open dropdown
Clicked "Holdings %" option from dropdown
Found 35 rows in Holdings% view
Processing data...
Successfully scraped data for: Parag Parikh Flexi Cap Fund
Total stocks: 35
Months available: 6
Data saved to Blob: https://...
Scraping completed successfully: Parag Parikh Flexi Cap Fund
```

## Docker Deployment

### Build and Run

```bash
# Build the image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Docker Commands

```bash
# Restart the container
docker-compose restart

# Check container status
docker-compose ps

# Execute commands inside container
docker-compose exec scraper sh
```

## VPS Deployment with Cloudflare Tunnel

### Prerequisites

- VPS with Docker installed
- Cloudflare account with domain
- SSH access to VPS

### Deployment Steps

1. **SSH into your VPS**
   ```bash
   ssh user@your-vps-ip
   ```

2. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd fund-scraper-server
   ```

3. **Create .env file**
   ```bash
   nano .env
   ```

   Add your production values:
   ```bash
   PORT=3001
   NODE_ENV=production
   API_KEY=<generate-secure-random-string>
   ALLOWED_ORIGIN=https://your-app.vercel.app
   BLOB_READ_WRITE_TOKEN=<your-vercel-blob-token>
   ```

4. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Setup Cloudflare Tunnel**

   Install cloudflared:
   ```bash
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

   Authenticate:
   ```bash
   cloudflared tunnel login
   ```

   Create tunnel:
   ```bash
   cloudflared tunnel create fund-scraper
   ```

   Configure tunnel (`~/.cloudflared/config.yml`):
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: /root/.cloudflared/<your-tunnel-id>.json

   ingress:
     - hostname: scraper.yourdomain.com
       service: http://localhost:3001
     - service: http_status:404
   ```

   Route DNS:
   ```bash
   cloudflared tunnel route dns fund-scraper scraper.yourdomain.com
   ```

   Run as service:
   ```bash
   sudo cloudflared service install
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

6. **Verify deployment**
   ```bash
   curl https://scraper.yourdomain.com/health
   ```

### Update Vercel Environment Variables

After deploying, update your Vercel app:

```bash
vercel env add SCRAPER_SERVER_URL
# Enter: https://scraper.yourdomain.com

vercel env add SCRAPER_API_KEY
# Enter: <same-key-as-server>

# Redeploy
git push
```

## API Reference

### POST /scrape

Scrapes fund holdings data from a ScanX Trade URL.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: <your-api-key>` (required)

**Body:**
```json
{
  "url": "https://scanx.trade/insight/mf-holdings/fund-name-holdings"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "fund_name": "Fund Name",
  "total_stocks": 35,
  "months_available": ["Nov 2024", "Oct 2024"],
  "filename": "fund-name-holdings.json",
  "blob_url": "https://..."
}
```

**Error Responses:**
- `400 Bad Request` - Invalid or missing URL
- `401 Unauthorized` - Invalid or missing API key
- `500 Internal Server Error` - Scraping failed

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T12:00:00.000Z",
  "service": "fund-scraper-server"
}
```

## Troubleshooting

### Playwright Browser Not Found

```bash
npx playwright install chromium
```

### Permission Denied on VPS

```bash
sudo chown -R $USER:$USER .
sudo chmod +x scripts/*
```

### Container Won't Start

Check logs:
```bash
docker-compose logs fund-scraper
```

Rebuild:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Cloudflare Tunnel Issues

Check tunnel status:
```bash
sudo systemctl status cloudflared
```

View tunnel logs:
```bash
sudo journalctl -u cloudflared -f
```

## Security Considerations

1. **Use strong API keys** - Generate with:
   ```bash
   openssl rand -hex 32
   ```

2. **Keep .env secure** - Never commit to git

3. **Enable CORS properly** - Set ALLOWED_ORIGIN to your exact domain

4. **Use HTTPS** - Always use Cloudflare Tunnel or similar for SSL

5. **Monitor logs** - Check for unauthorized access attempts

## Development

### Project Structure

```
fund-scraper-server/
├── server.js          # Express server with API endpoints
├── scraper.js         # Playwright scraping logic
├── Dockerfile         # Container definition
├── docker-compose.yml # Docker Compose config
├── package.json       # Dependencies
├── .env              # Environment variables (not in git)
├── .env.example      # Environment template
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

### Adding Features

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.
