import { storage } from "./storage";
import { getAllLastTradedPrices } from "./yahoo-finance";
import { getMarketStatus } from "./market-hours";
import { insertHistoricalDailyExpectedMovesSchema } from "@shared/schema";

let schedulerInterval: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

// Check if we should run the nightly calculation
// Runs once per day after market closes (after 5 PM ET)
function shouldRunNightlyCalculation(): boolean {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Already ran today
  if (lastRunDate === today) {
    return false;
  }
  
  // Check if market is closed
  const marketStatus = getMarketStatus();
  if (marketStatus.isOpen) {
    return false;
  }
  
  // Check if it's after 5 PM ET (market close time)
  const etHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
  
  // Run between 5 PM and 11:59 PM ET (after market close)
  if (etHour >= 17) {
    return true;
  }
  
  return false;
}

export async function runNightlyCalculation() {
  try {
    console.log("🌙 Starting nightly calculation...");
    
    // Step 1: Fetch latest prices from Yahoo Finance
    console.log("📊 Fetching Yahoo Finance data...");
    const quotes = await getAllLastTradedPrices();
    
    if (quotes.length === 0) {
      console.error("❌ No quotes received from Yahoo Finance");
      return;
    }
    
    console.log(`✅ Received ${quotes.length} quotes from Yahoo Finance`);
    
    // Step 2: Update all contracts with latest prices
    for (const quote of quotes) {
      const contract = await storage.getContractBySymbol(quote.symbol);
      if (!contract) {
        console.error(`Contract not found: ${quote.symbol}`);
        continue;
      }
      
      // Calculate daily volatility: σ_daily = σ_weekly / √5
      const dailyVolatility = contract.weeklyVolatility / Math.sqrt(5);
      
      // Update contract with latest price data
      await storage.updateContract(quote.symbol, {
        currentPrice: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        dailyChange: quote.regularMarketChange,
        dailyChangePercent: quote.regularMarketChangePercent,
      });
      
      console.log(`📈 Updated ${quote.symbol}: $${quote.regularMarketPrice.toFixed(2)}`);
    }
    
    // Step 3: Calculate next day expected moves based on updated data
    console.log("🔮 Calculating next day expected moves...");
    const results = [];
    
    for (const quote of quotes) {
      const contract = await storage.getContractBySymbol(quote.symbol);
      if (!contract) continue;
      
      // Calculate daily volatility
      const dailyVolatility = contract.weeklyVolatility / Math.sqrt(5);
      
      // Calculate expected move ranges for next trading day
      const expectedHigh = quote.regularMarketPrice + (quote.regularMarketPrice * dailyVolatility);
      const expectedLow = quote.regularMarketPrice - (quote.regularMarketPrice * dailyVolatility);
      
      // Create historical daily expected moves record
      const movesData = {
        contractSymbol: quote.symbol,
        date: new Date(), // Tomorrow's prediction based on today's close
        lastTradedPrice: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        weeklyVolatility: contract.weeklyVolatility,
        dailyVolatility,
        expectedHigh,
        expectedLow,
        actualClose: null,
        withinRange: null,
      };
      
      const validatedData = insertHistoricalDailyExpectedMovesSchema.parse(movesData);
      const created = await storage.createHistoricalDailyMoves(validatedData);
      results.push(created);
      
      console.log(`✨ ${quote.symbol} Expected: $${expectedLow.toFixed(2)} - $${expectedHigh.toFixed(2)}`);
    }
    
    // Mark this run as completed
    const now = new Date();
    lastRunDate = now.toISOString().split('T')[0];
    
    console.log(`✅ Nightly calculation completed! Processed ${results.length} contracts`);
    console.log(`📅 Next run: Tomorrow after 5 PM ET`);
    
    return results;
  } catch (error) {
    console.error("❌ Nightly calculation error:", error);
    throw error;
  }
}

// Start the scheduler (checks every hour)
export function startNightlyScheduler() {
  if (schedulerInterval) {
    console.log("⏰ Nightly scheduler already running");
    return;
  }
  
  console.log("⏰ Starting nightly scheduler...");
  console.log("📅 Will run automatically after market close (5 PM ET) each day");
  
  // Check every hour
  schedulerInterval = setInterval(async () => {
    if (shouldRunNightlyCalculation()) {
      await runNightlyCalculation();
    }
  }, 60 * 60 * 1000); // Check every hour
  
  // Also check immediately on startup
  setTimeout(async () => {
    if (shouldRunNightlyCalculation()) {
      await runNightlyCalculation();
    }
  }, 10000); // Wait 10 seconds after startup
}

// Stop the scheduler
export function stopNightlyScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("⏰ Nightly scheduler stopped");
  }
}
