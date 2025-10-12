/**
 * Advanced Volatility Models
 * Implements GARCH and other volatility estimation techniques
 */

export interface VolatilityResult {
  model: string;
  dailyVolatility: number;
  weeklyVolatility?: number;
  confidence: number;
  parameters?: Record<string, number>;
}

/**
 * Standard conversion: σ_daily = σ_weekly / √N
 * Where N = trading days remaining until expiration (defaults to 5 for weekly)
 */
export function standardVolatilityConversion(weeklyVolatility: number, daysRemaining?: number): VolatilityResult {
  const N = daysRemaining && daysRemaining > 0 ? daysRemaining : 5;
  const dailyVolatility = weeklyVolatility / Math.sqrt(N);
  
  return {
    model: 'Standard',
    dailyVolatility,
    weeklyVolatility,
    confidence: 0.68, // 1 standard deviation
  };
}

/**
 * GARCH(1,1) Model Simulation
 * Generalized Autoregressive Conditional Heteroskedasticity
 * σ²_t = ω + α * ε²_{t-1} + β * σ²_{t-1}
 */
export function garchVolatility(
  weeklyVolatility: number,
  recentPriceChange: number = 0,
  previousVolatility?: number,
  daysRemaining?: number
): VolatilityResult {
  // GARCH(1,1) parameters (typical values)
  const omega = 0.000001; // Long-term variance level
  const alpha = 0.1;      // Weight on recent shock
  const beta = 0.85;      // Weight on previous variance
  
  // Convert to variance
  const baseVariance = Math.pow(weeklyVolatility, 2);
  const prevVariance = previousVolatility ? Math.pow(previousVolatility, 2) : baseVariance;
  const recentShock = Math.pow(recentPriceChange / 100, 2);
  
  // GARCH forecast
  const forecastVariance = omega + alpha * recentShock + beta * prevVariance;
  const forecastVolatility = Math.sqrt(forecastVariance);
  
  // Convert to daily with dynamic scaling
  const N = daysRemaining && daysRemaining > 0 ? daysRemaining : 5;
  const dailyVolatility = forecastVolatility / Math.sqrt(N);
  
  return {
    model: 'GARCH(1,1)',
    dailyVolatility,
    weeklyVolatility: forecastVolatility,
    confidence: 0.75,
    parameters: { omega, alpha, beta },
  };
}

/**
 * Exponentially Weighted Moving Average (EWMA) Volatility
 * Used by RiskMetrics
 * σ²_t = λ * σ²_{t-1} + (1-λ) * r²_{t-1}
 */
export function ewmaVolatility(
  weeklyVolatility: number,
  recentPriceChange: number = 0,
  previousVolatility?: number,
  daysRemaining?: number
): VolatilityResult {
  const lambda = 0.94; // RiskMetrics uses 0.94 for daily data
  
  const prevVariance = previousVolatility 
    ? Math.pow(previousVolatility, 2) 
    : Math.pow(weeklyVolatility, 2);
  
  const recentReturn = recentPriceChange / 100;
  const forecastVariance = lambda * prevVariance + (1 - lambda) * Math.pow(recentReturn, 2);
  const forecastVolatility = Math.sqrt(forecastVariance);
  
  // Convert to daily with dynamic scaling
  const N = daysRemaining && daysRemaining > 0 ? daysRemaining : 5;
  const dailyVolatility = forecastVolatility / Math.sqrt(N);
  
  return {
    model: 'EWMA',
    dailyVolatility,
    weeklyVolatility: forecastVolatility,
    confidence: 0.70,
    parameters: { lambda },
  };
}

/**
 * Calculate volatility using selected model
 * All models now support dynamic scaling based on days remaining until expiration
 */
export function calculateVolatility(
  model: 'standard' | 'garch' | 'ewma',
  weeklyVolatility: number,
  recentPriceChange: number = 0,
  previousVolatility?: number,
  daysRemaining?: number
): VolatilityResult {
  switch (model) {
    case 'garch':
      return garchVolatility(weeklyVolatility, recentPriceChange, previousVolatility, daysRemaining);
    case 'ewma':
      return ewmaVolatility(weeklyVolatility, recentPriceChange, previousVolatility, daysRemaining);
    case 'standard':
    default:
      return standardVolatilityConversion(weeklyVolatility, daysRemaining);
  }
}
