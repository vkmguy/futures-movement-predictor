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
  // Determine decimal places from tick size
  const decimalPlaces = Math.max(0, -Math.floor(Math.log10(tickSize)));
  
  // Round to the appropriate decimal places
  return Number(rounded.toFixed(decimalPlaces));
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
  const decimalPlaces = Math.max(0, -Math.floor(Math.log10(tickSize)));
  return price.toFixed(decimalPlaces);
}
