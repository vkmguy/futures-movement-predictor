import yahooFinance from 'yahoo-finance2';

// Map our futures symbols to Yahoo Finance symbols
const SYMBOL_MAP: Record<string, string> = {
  '/NQ': 'NQ=F',  // E-mini Nasdaq-100 Futures
  '/ES': 'ES=F',  // E-mini S&P 500 Futures
  '/YM': 'YM=F',  // E-mini Dow Jones Futures
  '/RTY': 'RTY=F', // E-mini Russell 2000 Futures
  '/GC': 'GC=F',  // Gold Futures
  '/CL': 'CL=F',  // Crude Oil Futures
};

export interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketPreviousClose: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume?: number;
}

// In-memory cache to reduce API calls and prevent rate limiting
interface CacheEntry {
  quote: YahooQuote;
  timestamp: number;
}

const priceCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 seconds between requests
const INITIAL_RETRY_DELAY = 2000; // 2 seconds for first retry
const MAX_RETRIES = 3;

// Delay helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if rate limit error
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('Too Many Requests') || 
           error.message.includes('429') ||
           error.message.includes('rate limit');
  }
  return false;
}

// Single quote fetch with retry logic
async function fetchQuoteWithRetry(
  contractSymbol: string,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = INITIAL_RETRY_DELAY
): Promise<YahooQuote | null> {
  const yahooSymbol = SYMBOL_MAP[contractSymbol];
  if (!yahooSymbol) {
    console.error(`Unknown contract symbol: ${contractSymbol}`);
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const quote = await yahooFinance.quote(yahooSymbol);
      
      if (!quote || !quote.regularMarketPrice) {
        console.error(`No price data available for ${contractSymbol} (${yahooSymbol})`);
        return null;
      }

      const result: YahooQuote = {
        symbol: contractSymbol,
        regularMarketPrice: quote.regularMarketPrice,
        regularMarketPreviousClose: quote.regularMarketPreviousClose || quote.regularMarketPrice,
        regularMarketChange: quote.regularMarketChange || 0,
        regularMarketChangePercent: quote.regularMarketChangePercent || 0,
        regularMarketVolume: quote.regularMarketVolume,
      };

      // Cache the successful result
      priceCache.set(contractSymbol, {
        quote: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      const isRateLimit = isRateLimitError(error);
      
      if (isRateLimit && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`⏳ Rate limited on ${contractSymbol}, retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})`);
        await delay(backoffDelay);
        continue;
      }

      if (attempt === maxRetries) {
        console.error(`❌ Failed to fetch ${contractSymbol} after ${maxRetries} attempts:`, 
          error instanceof Error ? error.message : error);
      }
    }
  }

  return null;
}

export async function getLastTradedPrice(contractSymbol: string): Promise<YahooQuote | null> {
  // Check cache first
  const cached = priceCache.get(contractSymbol);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`📦 Using cached price for ${contractSymbol} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
    return cached.quote;
  }

  return fetchQuoteWithRetry(contractSymbol);
}

export async function getAllLastTradedPrices(): Promise<YahooQuote[]> {
  const symbols = Object.keys(SYMBOL_MAP);
  const results: YahooQuote[] = [];

  console.log(`📊 Fetching ${symbols.length} symbols sequentially with ${DELAY_BETWEEN_REQUESTS}ms delay...`);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    
    // Check cache first
    const cached = priceCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`  📦 ${symbol}: Using cached price`);
      results.push(cached.quote);
      continue;
    }

    // Fetch with retry
    const quote = await fetchQuoteWithRetry(symbol);
    if (quote) {
      console.log(`  ✅ ${symbol}: $${quote.regularMarketPrice.toFixed(2)}`);
      results.push(quote);
    } else {
      console.log(`  ❌ ${symbol}: Failed to fetch`);
    }

    // Add delay before next request (except for last one)
    if (i < symbols.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  console.log(`📊 Successfully fetched ${results.length}/${symbols.length} quotes`);
  return results;
}

// Clear cache (useful for testing or forced refresh)
export function clearPriceCache(): void {
  priceCache.clear();
  console.log('🗑️ Price cache cleared');
}

// Get cache stats (useful for debugging)
export function getCacheStats(): { size: number; entries: { symbol: string; age: number }[] } {
  const now = Date.now();
  const entries = Array.from(priceCache.entries()).map(([symbol, entry]) => ({
    symbol,
    age: Math.round((now - entry.timestamp) / 1000),
  }));
  
  return { size: priceCache.size, entries };
}
