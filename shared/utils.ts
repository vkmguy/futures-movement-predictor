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
