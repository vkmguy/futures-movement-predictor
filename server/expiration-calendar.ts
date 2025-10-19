/**
 * Expiration Calendar Service
 * 
 * Manages contract-specific expiration dates and trading days calculations
 * for futures contracts. Equity indices and commodities have different
 * expiration rules.
 */

import { addMonths, getDay, setDate, startOfMonth, endOfMonth, isBefore, isAfter, isWeekend, addDays, differenceInCalendarDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

// US Market Holidays for 2025 (CME Group observed holidays)
const US_MARKET_HOLIDAYS_2025 = [
  new Date('2025-01-01'), // New Year's Day
  new Date('2025-01-20'), // Martin Luther King Jr. Day
  new Date('2025-02-17'), // Presidents' Day
  new Date('2025-04-18'), // Good Friday
  new Date('2025-05-26'), // Memorial Day
  new Date('2025-07-04'), // Independence Day
  new Date('2025-09-01'), // Labor Day
  new Date('2025-11-27'), // Thanksgiving
  new Date('2025-12-25'), // Christmas
];

export interface ContractExpirationInfo {
  symbol: string;
  contractType: 'equity_index' | 'commodity';
  expirationDate: Date;
  lastTradingDay: Date;
  daysRemaining: number;
  isExpirationWeek: boolean;
}

/**
 * Get the third Friday of a given month
 */
function getThirdFriday(year: number, month: number): Date {
  const firstDay = startOfMonth(new Date(year, month - 1));
  let fridayCount = 0;
  let currentDay = firstDay;
  
  while (fridayCount < 3) {
    if (getDay(currentDay) === 5) { // 5 = Friday
      fridayCount++;
      if (fridayCount === 3) {
        return currentDay;
      }
    }
    currentDay = addDays(currentDay, 1);
  }
  
  return currentDay;
}

/**
 * Get expiration date for equity index futures
 * Equity indices (/NQ, /ES, /YM, /RTY) expire WEEKLY on Fridays (1-5 days)
 */
function getEquityIndexExpiration(contractMonth: Date): Date {
  // For weekly contracts, return the next Friday
  return getNextFriday(contractMonth);
}

/**
 * Get expiration date for commodity futures
 * Commodities have specific rules per contract
 */
function getCommodityExpiration(symbol: string, contractMonth: Date): Date {
  const year = contractMonth.getFullYear();
  const month = contractMonth.getMonth() + 1;
  
  switch (symbol) {
    case '/GC': // Gold futures - expires on third to last business day of contract month
      const lastDay = endOfMonth(contractMonth);
      let businessDayCount = 0;
      let currentDay = lastDay;
      
      while (businessDayCount < 3) {
        if (!isWeekend(currentDay) && !isUSMarketHoliday(currentDay)) {
          businessDayCount++;
          if (businessDayCount === 3) {
            return currentDay;
          }
        }
        currentDay = addDays(currentDay, -1);
      }
      return currentDay;
      
    case '/CL': // Crude Oil - expires 3 business days before the 25th of the month prior to delivery
      const priorMonth = addMonths(contractMonth, -1);
      const targetDate = setDate(priorMonth, 25);
      let clDate = targetDate;
      let daysBack = 0;
      
      while (daysBack < 3) {
        clDate = addDays(clDate, -1);
        if (!isWeekend(clDate) && !isUSMarketHoliday(clDate)) {
          daysBack++;
        }
      }
      return clDate;
      
    default:
      // Default to third Friday for unknown commodities
      return getThirdFriday(year, month);
  }
}

/**
 * Check if a date is a US market holiday
 */
function isUSMarketHoliday(date: Date): boolean {
  return US_MARKET_HOLIDAYS_2025.some(holiday => 
    holiday.getFullYear() === date.getFullYear() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getDate() === date.getDate()
  );
}

/**
 * Calculate trading days between two dates (excluding weekends and holidays)
 */
export function calculateTradingDays(startDate: Date, endDate: Date): number {
  if (isAfter(startDate, endDate)) {
    return 0;
  }
  
  let tradingDays = 0;
  let currentDay = new Date(startDate);
  
  while (isBefore(currentDay, endDate) || currentDay.getTime() === endDate.getTime()) {
    if (!isWeekend(currentDay) && !isUSMarketHoliday(currentDay)) {
      tradingDays++;
    }
    currentDay = addDays(currentDay, 1);
  }
  
  return tradingDays;
}

/**
 * Get the next Friday at market close from a given date
 * Handles ET timezone correctly for Friday 5 PM market close
 * Uses Intl.DateTimeFormat.formatToParts to get ET components without string parsing issues
 */
function getNextFriday(fromDate: Date): Date {
  // Use formatToParts to get ET timezone components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(fromDate);
  const etHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  
  // Get weekday from the parts
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value || '';
  const weekdayMap: {[key: string]: number} = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const etDayOfWeek = weekdayMap[weekdayStr] ?? 0;
  
  // Determine days to add to get to next Friday
  let daysToAdd = 0;
  
  if (etDayOfWeek === 5) {
    // It's Friday in ET
    if (etHour >= 17) {
      // After 5 PM ET - roll to next Friday
      daysToAdd = 7;
    }
    // else: Before 5 PM ET - stay on current Friday (daysToAdd = 0)
  } else {
    // Not Friday - calculate days until next Friday
    daysToAdd = (5 - etDayOfWeek + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
  }
  
  // Return the target Friday
  return addDays(fromDate, daysToAdd);
}

/**
 * Get current contract month for a futures symbol
 * This uses the front month (nearest expiration) by default
 */
function getCurrentContractMonth(symbol: string): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // For equity indices, use WEEKLY Friday expirations (1-5 days)
  // These contracts expire every Friday, not quarterly
  if (['/NQ', '/ES', '/YM', '/RTY'].includes(symbol)) {
    // Return a date object representing the current week
    // The actual expiration will be calculated by getEquityIndexExpiration
    return now;
  }
  
  // For commodities, use monthly contracts
  let contractMonth = new Date(currentYear, currentMonth, 1);
  const expiration = getCommodityExpiration(symbol, contractMonth);
  
  // If expiration has passed, move to next month
  if (isBefore(expiration, now)) {
    contractMonth = addMonths(contractMonth, 1);
  }
  
  return contractMonth;
}

/**
 * Get expiration information for a contract
 */
export function getContractExpirationInfo(symbol: string, currentDate: Date = new Date()): ContractExpirationInfo {
  const contractType = ['/NQ', '/ES', '/YM', '/RTY'].includes(symbol) ? 'equity_index' : 'commodity';
  const contractMonth = getCurrentContractMonth(symbol);
  
  let expirationDate: Date;
  if (contractType === 'equity_index') {
    expirationDate = getEquityIndexExpiration(contractMonth);
  } else {
    expirationDate = getCommodityExpiration(symbol, contractMonth);
  }
  
  const daysRemaining = calculateTradingDays(currentDate, expirationDate);
  
  // Check if we're in expiration week (5 or fewer trading days)
  const isExpirationWeek = daysRemaining <= 5 && daysRemaining > 0;
  
  return {
    symbol,
    contractType,
    expirationDate,
    lastTradingDay: expirationDate,
    daysRemaining,
    isExpirationWeek,
  };
}

/**
 * Get expiration info for all contracts
 */
export function getAllContractExpirations(currentDate: Date = new Date()): ContractExpirationInfo[] {
  const symbols = ['/NQ', '/ES', '/YM', '/RTY', '/GC', '/CL'];
  return symbols.map(symbol => getContractExpirationInfo(symbol, currentDate));
}

/**
 * Calculate dynamic daily volatility based on days remaining
 * UPDATED METHODOLOGY (October 2025): σ_daily = annualizedIV × √(N/252) where N = trading days remaining
 * Uses 252 trading days per year (industry standard) instead of 365 calendar days
 * This properly converts annualized IV to daily volatility accounting for time decay
 */
export function calculateDynamicDailyVolatility(
  annualizedIV: number,
  daysRemaining: number
): number {
  // Ensure we have at least 1 day remaining to avoid issues
  const days = Math.max(daysRemaining, 1);
  // FORMULA: annualizedIV × √(days/252) - using 252 trading days/year
  return annualizedIV * Math.sqrt(days / 252);
}
