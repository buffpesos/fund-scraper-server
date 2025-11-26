const { chromium } = require('playwright');
const { put } = require('@vercel/blob');

async function extractTableData(page) {
  const jsCode = `
    (() => {
        function extractTableData() {
            const result = {
                headers: [],
                rows: [],
                fund_name: ''
            };

            // Try to get fund name from title or header
            // Look for specific patterns in ScanX Trade pages
            let titleElement = document.querySelector('h1.text-2xl, h1');

            // If we found an h1, check if it contains "Insights" (ScanX header)
            // If so, try to find the actual fund name from breadcrumb or subtitle
            if (titleElement && titleElement.innerText.includes('Insights')) {
                // Try breadcrumb or subtitle
                const breadcrumb = document.querySelector('[class*="breadcrumb"] a:last-child, nav a:last-child');
                if (breadcrumb) {
                    titleElement = breadcrumb;
                } else {
                    // Try h2 or other headers
                    titleElement = document.querySelector('h2, h3, [class*="fund-name"]');
                }
            }

            if (titleElement) {
                result.fund_name = titleElement.innerText.trim();
            }

            // Find the main table
            const table = document.querySelector('table');
            if (!table) {
                return { error: 'No table found on page' };
            }

            // Extract headers (month columns)
            const headerRow = table.querySelector('thead tr, tr:first-child');
            if (headerRow) {
                const headers = headerRow.querySelectorAll('th, td');
                result.headers = Array.from(headers).map(h => h.innerText.trim());
            }

            // Extract ALL rows - including hidden ones
            const allRows = table.querySelectorAll('tbody tr, tr');

            allRows.forEach((row, index) => {
                // Skip header row
                if (row.closest('thead')) return;

                const cells = row.querySelectorAll('td, th');
                if (cells.length === 0) return;

                const rowData = Array.from(cells).map(cell => cell.innerText.trim());
                if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
                    result.rows.push(rowData);
                }
            });

            return result;
        }

        return extractTableData();
    })();
  `;

  const result = await page.evaluate(jsCode);
  return result;
}

async function scrapeHoldingsData(url) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    console.log('Navigating to the page...');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Extract SHARES data (default view)
    console.log('Extracting SHARES data...');
    const sharesData = await extractTableData(page);

    if (sharesData.error) {
      throw new Error(sharesData.error);
    }

    console.log(`Found ${sharesData.rows.length} rows in SHARES view`);

    // Switch to Holdings% view
    console.log('Switching to Holdings% view...');
    let holdingsData = null;

    try {
      // Click the "Shares" button to open dropdown
      const sharesButton = await page.waitForSelector('button:has-text("Shares")', { timeout: 5000 });
      if (sharesButton) {
        await sharesButton.click();
        console.log('Clicked "Shares" button to open dropdown');
        await page.waitForTimeout(1000);

        // Click the "Holdings %" option from dropdown
        const holdingsOption = await page.waitForSelector('text="Holdings %"', { timeout: 5000 });
        if (holdingsOption) {
          await holdingsOption.click();
          console.log('Clicked "Holdings %" option from dropdown');
          await page.waitForTimeout(2000);

          // Extract Holdings% data
          console.log('Extracting Holdings% data...');
          holdingsData = await extractTableData(page);

          if (!holdingsData.error) {
            console.log(`Found ${holdingsData.rows.length} rows in Holdings% view`);
          }
        }
      }
    } catch (e) {
      console.error('Error switching views:', e);
    }

    // Process and combine the data
    console.log('Processing data...');

    // Extract fund name from URL as fallback
    let fundName = sharesData.fund_name;
    if (!fundName || fundName === 'Insights' || fundName === '') {
      // Extract from URL: /mf-holdings/parag-parikh-flexi-cap-fund-direct-growth-holdings
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname;
      const urlParts = urlPath.split('/').filter(Boolean);
      const lastPart = urlParts[urlParts.length - 1];

      if (lastPart) {
        // Just use the URL slug as-is
        fundName = lastPart;
      } else {
        fundName = 'Unknown Fund';
      }
    }

    const combinedData = {
      fund_name: fundName,
      months_available: sharesData.headers.slice(1),
      stocks: [],
      total_stocks: sharesData.rows.length,
    };

    // Combine shares and holdings% data
    for (let i = 0; i < sharesData.rows.length; i++) {
      const shareRow = sharesData.rows[i];
      const stockName = shareRow[0] || 'Unknown';

      const holdingsRow = holdingsData && i < holdingsData.rows.length
        ? holdingsData.rows[i]
        : null;

      const monthlyData = [];
      for (let j = 0; j < combinedData.months_available.length; j++) {
        const month = combinedData.months_available[j];
        const monthEntry = { month };

        if (j + 1 < shareRow.length) {
          monthEntry.shares = shareRow[j + 1];
        }

        if (holdingsRow && j + 1 < holdingsRow.length) {
          monthEntry.holdings_percentage = holdingsRow[j + 1];
        }

        monthlyData.push(monthEntry);
      }

      combinedData.stocks.push({
        stock_name: stockName,
        sector: null,
        monthly_data: monthlyData,
      });
    }

    // Save to Vercel Blob storage
    // Extract filename from URL (last part of the path)
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname;
    const filename = urlPath.split('/').filter(Boolean).pop() || 'unknown-fund';
    const blobFilename = `${filename}.json`;

    const blob = await put(blobFilename, JSON.stringify(combinedData, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    console.log(`Successfully scraped data for: ${combinedData.fund_name}`);
    console.log(`Total stocks: ${combinedData.total_stocks}`);
    console.log(`Months available: ${combinedData.months_available.length}`);
    console.log(`Data saved to Blob: ${blob.url}`);

    return {
      success: true,
      fund_name: combinedData.fund_name,
      total_stocks: combinedData.total_stocks,
      months_available: combinedData.months_available,
      filename: blobFilename,
      blob_url: blob.url,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeHoldingsData };
