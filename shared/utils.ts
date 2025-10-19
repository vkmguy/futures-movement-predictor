/**
 * Rounds a price value to the nearest valid tick increment for futures contracts.
 * 
 * Futures contracts trade in specific tick sizes (minimum price increments).
 * This function ensures all calculated values conform to real market trading increments.
 * 
 * @param price - The raw price value to round
 * @param tickSize - The minimum price increment for the contract (e.g., 0.25, 0.10, 0.01)
 * @returns The price rounded to the nearest tick
 * 
 * @example
 * roundToTick(24726.678, 0.25)  // Returns 24726.75 (nearest 0.25 increment)
 * roundToTick(2234.234, 0.10)   // Returns 2234.20 (nearest 0.10 increment)
 * roundToTick(58.9087, 0.01)    // Returns 58.91 (nearest 0.01 increment)
 * roundToTick(45706.3, 1.0)     // Returns 45706.00 (nearest 1.0 increment)
 */
export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) {
    throw new Error('Tick size must be greater than 0');
  }
  
  // Round to nearest tick increment
  const rounded = Math.round(price / tickSize) * tickSize;
  
  // Fix floating point precision issues
  // Determine decimal places by examining the tick size string
  // This correctly handles fractional ticks like 0.25 (2 decimals) and 0.10 (1 decimal)
  const decimalPlaces = getDecimalPlaces(tickSize);
  
  // Round to the appropriate decimal places
  return Number(rounded.toFixed(decimalPlaces));
}

/**
 * Determines the number of decimal places needed to represent a tick size.
 * Handles fractional tick sizes correctly (e.g., 0.25 → 2, 0.10 → 1, 0.01 → 2).
 * 
 * @param tickSize - The tick size to analyze
 * @returns Number of decimal places required
 */
function getDecimalPlaces(tickSize: number): number {
  const tickStr = tickSize.toString();
  if (!tickStr.includes('.')) {
    return 0; // Whole number tick size (e.g., 1.0)
  }
  return tickStr.split('.')[1].length;
}

/**
 * Formats a price value with the appropriate number of decimal places based on tick size.
 * 
 * @param price - The price value to format
 * @param tickSize - The minimum price increment for the contract
 * @returns The formatted price string
 * 
 * @example
 * formatTickPrice(24726.75, 0.25)  // Returns "24726.75"
 * formatTickPrice(45706, 1.0)      // Returns "45706.00"
 * formatTickPrice(58.91, 0.01)     // Returns "58.91"
 */
export function formatTickPrice(price: number, tickSize: number): string {
  const decimalPlaces = getDecimalPlaces(tickSize);
  return price.toFixed(decimalPlaces);
}

/**
 * Calculates the next Monday from a given date.
 * Used for forward-looking weekly predictions that forecast the upcoming week.
 * 
 * @param fromDate - The reference date (defaults to current date)
 * @returns The next Monday as a Date object
 * 
 * @example
 * // If today is Friday Oct 18, 2025
 * getNextMonday()  // Returns Monday Oct 20, 2025
 * 
 * // If today is Monday Oct 20, 2025
 * getNextMonday()  // Returns Monday Oct 27, 2025
 * 
 * // If today is Saturday Oct 19, 2025
 * getNextMonday()  // Returns Monday Oct 20, 2025
 */
export function getNextMonday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  date.setHours(0, 0, 0, 0); // Reset to start of day
  
  const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days until next Monday
  // If today is Monday (1), we want next Monday (7 days)
  // If today is Tuesday (2), we want 6 days ahead
  // If today is Sunday (0), we want 1 day ahead
  const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}
