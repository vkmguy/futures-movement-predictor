import { storage } from "./storage";
import { getAllLastTradedPrices } from "./yahoo-finance";
import { getMarketStatus } from "./market-hours";
import { insertHistoricalDailyExpectedMovesSchema } from "@shared/schema";
import { getContractExpirationInfo, calculateDynamicDailyVolatility } from "./expiration-calendar";
import { roundToTick, getNextMonday } from "@shared/utils";
import { calculateWeeklyExpectedMoves, getCurrentDayOfWeek } from "./weekly-calculator";

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

// Check if we should generate weekly moves (only on Saturdays)
function shouldGenerateWeeklyMoves(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Only generate on Saturday (day 6)
  if (dayOfWeek !== 6) {
    return false;
  }
  
  // Check if we already ran weekly generation today
  const today = now.toISOString().split('T')[0];
  if (lastRunDate === today) {
    return false;
  }
  
  return true;
}

export async function generateWeeklyMovesForAllContracts() {
  try {
    console.log("📅 Generating weekly expected moves for upcoming week...");
    
    const contracts = await storage.getAllContracts();
    const results = [];
    const nextMonday = getNextMonday();
    
    console.log(`🗓️  Calculating moves for week starting: ${nextMonday.toISOString().split('T')[0]}`);
    
    for (const contract of contracts) {
      // Calculate weekly moves for next week
      const calculatedMoves = calculateWeeklyExpectedMoves(
        contract.symbol,
        contract.currentPrice,
        contract.weeklyVolatility,
        nextMonday, // Use next Monday as week start
        "1" // Start with Monday (day 1 as string)
      );
      
      // Check if moves already exist for this contract and week
      const existing = await storage.getWeeklyMoves(contract.symbol);
      
      if (existing && existing.weekStartDate.toISOString().split('T')[0] === nextMonday.toISOString().split('T')[0]) {
        console.log(`✓ Weekly moves already exist for ${contract.symbol} (week of ${nextMonday.toISOString().split('T')[0]})`);
        results.push(existing);
        continue;
      }
      
      // Create new weekly moves for upcoming week
      const result = await storage.createWeeklyMoves(calculatedMoves);
      results.push(result);
      
      console.log(`✨ Generated weekly moves for ${contract.symbol} (week starting ${nextMonday.toISOString().split('T')[0]})`);
    }
    
    console.log(`✅ Weekly moves generation completed! Generated ${results.length} predictions for upcoming week`);
    return results;
  } catch (error) {
    console.error("❌ Weekly moves generation error:", error);
    throw error;
  }
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
    
    // Step 2: Update all contracts with latest prices and expiration data
    for (const quote of quotes) {
      const contract = await storage.getContractBySymbol(quote.symbol);
      if (!contract) {
        console.error(`Contract not found: ${quote.symbol}`);
        continue;
      }
      
      // Get expiration information for this contract
      const expirationInfo = getContractExpirationInfo(quote.symbol, new Date());
      
      // Calculate dynamic daily volatility: σ_daily = σ_weekly / √N
      const dailyVolatility = calculateDynamicDailyVolatility(
        contract.weeklyVolatility,
        expirationInfo.daysRemaining
      );
      
      // Update contract with latest price data and expiration info
      await storage.updateContract(quote.symbol, {
        currentPrice: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        dailyChange: quote.regularMarketChange,
        dailyChangePercent: quote.regularMarketChangePercent,
        dailyVolatility,
        contractType: expirationInfo.contractType,
        expirationDate: expirationInfo.expirationDate,
        daysRemaining: expirationInfo.daysRemaining,
        isExpirationWeek: expirationInfo.isExpirationWeek ? 1 : 0,
      });
      
      console.log(`📈 Updated ${quote.symbol}: $${quote.regularMarketPrice.toFixed(2)} (${expirationInfo.daysRemaining} days to expiration)`);
    }
    
    // Step 3: Calculate next day expected moves based on updated data
    console.log("🔮 Calculating next day expected moves...");
    const results = [];
    
    for (const quote of quotes) {
      const contract = await storage.getContractBySymbol(quote.symbol);
      if (!contract) continue;
      
      // Get the updated daily volatility from contract (now using dynamic N)
      const dailyVolatility = contract.dailyVolatility;
      
      // Calculate expected move ranges for next trading day (before tick rounding)
      const rawExpectedHigh = quote.regularMarketPrice + (quote.regularMarketPrice * dailyVolatility);
      const rawExpectedLow = quote.regularMarketPrice - (quote.regularMarketPrice * dailyVolatility);
      
      // Round to valid tick increments for the contract
      const expectedHigh = roundToTick(rawExpectedHigh, contract.tickSize);
      const expectedLow = roundToTick(rawExpectedLow, contract.tickSize);
      
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
      
      const daysRemainingInfo = contract.daysRemaining ? ` (√${contract.daysRemaining} scaling)` : '';
      console.log(`✨ ${quote.symbol} Expected: $${expectedLow.toFixed(2)} - $${expectedHigh.toFixed(2)}${daysRemainingInfo}`);
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
    // Daily calculation after market close
    if (shouldRunNightlyCalculation()) {
      await runNightlyCalculation();
    }
    
    // Weekly moves generation on Saturday
    if (shouldGenerateWeeklyMoves()) {
      await generateWeeklyMovesForAllContracts();
    }
  }, 60 * 60 * 1000); // Check every hour
  
  // Also check immediately on startup
  setTimeout(async () => {
    if (shouldRunNightlyCalculation()) {
      await runNightlyCalculation();
    }
    if (shouldGenerateWeeklyMoves()) {
      await generateWeeklyMovesForAllContracts();
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
