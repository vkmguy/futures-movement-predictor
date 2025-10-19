import type { InsertWeeklyExpectedMoves } from "@shared/schema";

/**
 * Calculate weekly expected moves from Monday to Friday
 * NEW METHODOLOGY (October 2025): weeklyMove = lastPrice × iv × √(5/365)
 * Then calculates daily moves based on remaining days in the week
 */

interface DailyMove {
  expectedHigh: number;
  expectedLow: number;
  actualClose?: number;
}

/**
 * NEW FORMULA: Calculate weekly expected moves using annualized IV
 * weeklyMove = lastPrice × iv × √(5/365) ≈ lastPrice × iv × 0.117
 * Then for each day: dailyMove = currentPrice × (weeklyMove / √5) or recalculate based on remaining days
 */
export function calculateWeeklyExpectedMoves(
  contractSymbol: string,
  currentPrice: number,
  annualizedIV: number, // Implied volatility as decimal (e.g., 0.20 for 20%)
  weekStartDate: Date,
  currentDayOfWeek: string
): InsertWeeklyExpectedMoves {
  // NEW FORMULA: Weekly expected move = lastPrice × iv × √(5/365)
  const weeklyExpectedMove = currentPrice * annualizedIV * Math.sqrt(5 / 365);
  
  // Daily volatility derived from weekly: dailyVol = weeklyMove / √5
  const dailyVolatility = weeklyExpectedMove / Math.sqrt(5);
  
  const weekOpenPrice = currentPrice;
  
  // For cumulative expected moves from week start, use √n scaling
  // Monday (1 day from open): ±dailyVol × √1
  const mondayMove = dailyVolatility * Math.sqrt(1);
  const monday: DailyMove = {
    expectedHigh: weekOpenPrice + mondayMove,
    expectedLow: weekOpenPrice - mondayMove,
  };
  
  // Tuesday (2 days from open): ±dailyVol × √2
  const tuesdayMove = dailyVolatility * Math.sqrt(2);
  const tuesday: DailyMove = {
    expectedHigh: weekOpenPrice + tuesdayMove,
    expectedLow: weekOpenPrice - tuesdayMove,
  };
  
  // Wednesday (3 days from open): ±dailyVol × √3
  const wednesdayMove = dailyVolatility * Math.sqrt(3);
  const wednesday: DailyMove = {
    expectedHigh: weekOpenPrice + wednesdayMove,
    expectedLow: weekOpenPrice - wednesdayMove,
  };
  
  // Thursday (4 days from open): ±dailyVol × √4
  const thursdayMove = dailyVolatility * Math.sqrt(4);
  const thursday: DailyMove = {
    expectedHigh: weekOpenPrice + thursdayMove,
    expectedLow: weekOpenPrice - thursdayMove,
  };
  
  // Friday (5 days from open): ±dailyVol × √5 = ±weeklyMove
  const fridayMove = dailyVolatility * Math.sqrt(5);
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
    
    impliedVolatility: annualizedIV, // Store the annualized IV used
    weeklyVolatility: annualizedIV, // For backward compatibility, store same value
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
  const weekStart = new Date(today);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get next Monday's date (for forward-looking weekly predictions)
 */
export function getNextMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day; // If Sunday (0), next day is Monday; otherwise calculate
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

/**
 * Get remaining trading days in current week (Monday = 5, Tuesday = 4, etc.)
 */
export function getRemainingTradingDays(): number {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend: 0 trading days remaining in current week
    return 0;
  }
  
  // Monday (1) = 5 days, Tuesday (2) = 4 days, ..., Friday (5) = 1 day
  return 6 - dayOfWeek;
}
