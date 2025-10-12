/**
 * Expiration Calendar Service
 * 
 * Manages contract-specific expiration dates and trading days calculations
 * for futures contracts. Equity indices and commodities have different
 * expiration rules.
 */

import { addMonths, getDay, setDate, startOfMonth, endOfMonth, isBefore, isAfter, isWeekend, addDays, differenceInCalendarDays } from 'date-fns';

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
 * Equity indices (/NQ, /ES, /YM, /RTY) expire on the third Friday of the contract month
 */
function getEquityIndexExpiration(contractMonth: Date): Date {
  const year = contractMonth.getFullYear();
  const month = contractMonth.getMonth() + 1;
  return getThirdFriday(year, month);
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
 * Get current contract month for a futures symbol
 * This uses the front month (nearest expiration) by default
 */
function getCurrentContractMonth(symbol: string): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // For equity indices, use quarterly expirations (Mar, Jun, Sep, Dec)
  if (['/NQ', '/ES', '/YM', '/RTY'].includes(symbol)) {
    const quarterlyMonths = [2, 5, 8, 11]; // March, June, September, December (0-indexed)
    
    // Find the next quarterly month
    let nextQuarterMonth = quarterlyMonths.find(m => m >= currentMonth);
    
    if (nextQuarterMonth === undefined) {
      // Roll to next year's March
      return new Date(currentYear + 1, 2, 1);
    }
    
    const contractMonth = new Date(currentYear, nextQuarterMonth, 1);
    const expiration = getEquityIndexExpiration(contractMonth);
    
    // If expiration has passed, move to next quarter
    if (isBefore(expiration, now)) {
      const nextQuarterIndex = quarterlyMonths.indexOf(nextQuarterMonth) + 1;
      if (nextQuarterIndex >= quarterlyMonths.length) {
        return new Date(currentYear + 1, 2, 1);
      }
      return new Date(currentYear, quarterlyMonths[nextQuarterIndex], 1);
    }
    
    return contractMonth;
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
 * σ_daily = σ_weekly / √N where N = trading days remaining
 */
export function calculateDynamicDailyVolatility(
  weeklyVolatility: number,
  daysRemaining: number
): number {
  // Ensure we have at least 1 day remaining to avoid division by zero
  const N = Math.max(daysRemaining, 1);
  return weeklyVolatility / Math.sqrt(N);
}
