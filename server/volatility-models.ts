/**
 * Advanced Volatility Models
 * NEW METHODOLOGY (October 2025): Uses annualized IV with √(days/365) scaling
 * Formula: expectedMove = currentPrice × iv × √(daysToExpiration/365)
 */

export interface VolatilityResult {
  model: string;
  dailyMove: number; // The actual dollar move for the day
  annualizedIV: number; // The IV used in calculation
  confidence: number;
  parameters?: Record<string, number>;
}

/**
 * NEW FORMULA: Standard volatility calculation using annualized IV
 * dailyMove = currentPrice × iv × √(daysToExpiration/365)
 * This replaces the old σ_daily = σ_weekly / √N formula
 */
export function standardVolatilityCalculation(
  currentPrice: number,
  annualizedIV: number,
  daysToExpiration: number
): VolatilityResult {
  // dailyMove = currentPrice × iv × √(daysToExpiration/365)
  const dailyMove = currentPrice * annualizedIV * Math.sqrt(daysToExpiration / 365);
  
  return {
    model: 'Standard',
    dailyMove,
    annualizedIV,
    confidence: 0.68, // 1 standard deviation
  };
}

/**
 * GARCH(1,1) Model with new methodology
 * Applies GARCH to adjust IV, then uses new formula
 */
export function garchVolatility(
  currentPrice: number,
  annualizedIV: number,
  daysToExpiration: number,
  recentPriceChange: number = 0,
  previousVolatility?: number
): VolatilityResult {
  // GARCH(1,1) parameters (typical values)
  const omega = 0.000001; // Long-term variance level
  const alpha = 0.1;      // Weight on recent shock
  const beta = 0.85;      // Weight on previous variance
  
  // Convert to variance
  const baseVariance = Math.pow(annualizedIV, 2);
  const prevVariance = previousVolatility ? Math.pow(previousVolatility, 2) : baseVariance;
  const recentShock = Math.pow(recentPriceChange / 100, 2);
  
  // GARCH forecast
  const forecastVariance = omega + alpha * recentShock + beta * prevVariance;
  const adjustedIV = Math.sqrt(forecastVariance);
  
  // Apply new formula with adjusted IV
  const dailyMove = currentPrice * adjustedIV * Math.sqrt(daysToExpiration / 365);
  
  return {
    model: 'GARCH(1,1)',
    dailyMove,
    annualizedIV: adjustedIV,
    confidence: 0.75,
    parameters: { omega, alpha, beta },
  };
}

/**
 * EWMA Volatility with new methodology
 * Applies EWMA to adjust IV, then uses new formula
 */
export function ewmaVolatility(
  currentPrice: number,
  annualizedIV: number,
  daysToExpiration: number,
  recentPriceChange: number = 0,
  previousVolatility?: number
): VolatilityResult {
  const lambda = 0.94; // RiskMetrics uses 0.94 for daily data
  
  const prevVariance = previousVolatility 
    ? Math.pow(previousVolatility, 2) 
    : Math.pow(annualizedIV, 2);
  
  const recentReturn = recentPriceChange / 100;
  const forecastVariance = lambda * prevVariance + (1 - lambda) * Math.pow(recentReturn, 2);
  const adjustedIV = Math.sqrt(forecastVariance);
  
  // Apply new formula with adjusted IV
  const dailyMove = currentPrice * adjustedIV * Math.sqrt(daysToExpiration / 365);
  
  return {
    model: 'EWMA',
    dailyMove,
    annualizedIV: adjustedIV,
    confidence: 0.70,
    parameters: { lambda },
  };
}

/**
 * Calculate expected move using selected model
 * NEW METHODOLOGY: All models now use currentPrice × iv × √(days/365)
 */
export function calculateExpectedMove(
  model: 'standard' | 'garch' | 'ewma',
  currentPrice: number,
  annualizedIV: number,
  daysToExpiration: number,
  recentPriceChange: number = 0,
  previousVolatility?: number
): VolatilityResult {
  switch (model) {
    case 'garch':
      return garchVolatility(currentPrice, annualizedIV, daysToExpiration, recentPriceChange, previousVolatility);
    case 'ewma':
      return ewmaVolatility(currentPrice, annualizedIV, daysToExpiration, recentPriceChange, previousVolatility);
    case 'standard':
    default:
      return standardVolatilityCalculation(currentPrice, annualizedIV, daysToExpiration);
  }
}
