import type { InsertWeeklyExpectedMoves } from "@shared/schema";

/**
 * Calculate weekly expected moves from Monday to Friday
 * Based on Implied Volatility and current price
 */

interface DailyMove {
  expectedHigh: number;
  expectedLow: number;
  actualClose?: number;
}

export function calculateWeeklyExpectedMoves(
  contractSymbol: string,
  currentPrice: number,
  weeklyVolatility: number, // Already converted weekly volatility (not annual)
  weekStartDate: Date,
  currentDayOfWeek: string
): InsertWeeklyExpectedMoves {
  // Weekly volatility is already provided (σ_weekly)
  // Daily volatility: σ_daily = σ_weekly / √5
  const dailyVolatility = weeklyVolatility / Math.sqrt(5);
  
  const weekOpenPrice = currentPrice;
  
  // For cumulative expected moves, use σ * √n formula where n = number of days
  // Monday (1 day): ±1σ_daily
  const mondayMove = weekOpenPrice * dailyVolatility * Math.sqrt(1);
  const monday: DailyMove = {
    expectedHigh: weekOpenPrice + mondayMove,
    expectedLow: weekOpenPrice - mondayMove,
  };
  
  // Tuesday (2 days from Monday open): ±σ_daily * √2
  const tuesdayMove = weekOpenPrice * dailyVolatility * Math.sqrt(2);
  const tuesday: DailyMove = {
    expectedHigh: weekOpenPrice + tuesdayMove,
    expectedLow: weekOpenPrice - tuesdayMove,
  };
  
  // Wednesday (3 days from Monday open): ±σ_daily * √3
  const wednesdayMove = weekOpenPrice * dailyVolatility * Math.sqrt(3);
  const wednesday: DailyMove = {
    expectedHigh: weekOpenPrice + wednesdayMove,
    expectedLow: weekOpenPrice - wednesdayMove,
  };
  
  // Thursday (4 days from Monday open): ±σ_daily * √4
  const thursdayMove = weekOpenPrice * dailyVolatility * Math.sqrt(4);
  const thursday: DailyMove = {
    expectedHigh: weekOpenPrice + thursdayMove,
    expectedLow: weekOpenPrice - thursdayMove,
  };
  
  // Friday (5 days from Monday open): ±σ_daily * √5 = ±σ_weekly
  const fridayMove = weekOpenPrice * dailyVolatility * Math.sqrt(5);
  const friday: DailyMove = {
    expectedHigh: weekOpenPrice + fridayMove,
    expectedLow: weekOpenPrice - fridayMove,
  };
  
  return {
    contractSymbol,
    weekStartDate,
    currentDayOfWeek,
    weekOpenPrice,
    
    mondayExpectedHigh: monday.expectedHigh,
    mondayExpectedLow: monday.expectedLow,
    mondayActualClose: null,
    
    tuesdayExpectedHigh: tuesday.expectedHigh,
    tuesdayExpectedLow: tuesday.expectedLow,
    tuesdayActualClose: null,
    
    wednesdayExpectedHigh: wednesday.expectedHigh,
    wednesdayExpectedLow: wednesday.expectedLow,
    wednesdayActualClose: null,
    
    thursdayExpectedHigh: thursday.expectedHigh,
    thursdayExpectedLow: thursday.expectedLow,
    thursdayActualClose: null,
    
    fridayExpectedHigh: friday.expectedHigh,
    fridayExpectedLow: friday.expectedLow,
    fridayActualClose: null,
    
    impliedVolatility: weeklyVolatility, // Store weeklyVolatility as impliedVolatility field
    weeklyVolatility,
  };
}

/**
 * Get current day of week as lowercase string
 */
export function getCurrentDayOfWeek(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date();
  return days[today.getDay()];
}

/**
 * Get start of current week (Monday)
 */
export function getWeekStartDate(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  return new Date(today.setDate(diff));
}
