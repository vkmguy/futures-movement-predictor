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

export async function getLastTradedPrice(contractSymbol: string): Promise<YahooQuote | null> {
  try {
    const yahooSymbol = SYMBOL_MAP[contractSymbol];
    if (!yahooSymbol) {
      console.error(`Unknown contract symbol: ${contractSymbol}`);
      return null;
    }

    const quote = await yahooFinance.quote(yahooSymbol);
    
    if (!quote || !quote.regularMarketPrice) {
      console.error(`No price data available for ${contractSymbol} (${yahooSymbol})`);
      return null;
    }

    return {
      symbol: contractSymbol,
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketPreviousClose: quote.regularMarketPreviousClose || quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      regularMarketVolume: quote.regularMarketVolume,
    };
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${contractSymbol}:`, error);
    return null;
  }
}

export async function getAllLastTradedPrices(): Promise<YahooQuote[]> {
  const symbols = Object.keys(SYMBOL_MAP);
  const promises = symbols.map(symbol => getLastTradedPrice(symbol));
  const results = await Promise.all(promises);
  return results.filter((quote): quote is YahooQuote => quote !== null);
}
