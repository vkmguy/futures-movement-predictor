/**
 * Market Hours Utility
 * Handles futures market trading hours detection
 * 
 * E-mini Futures Trading Hours (CME):
 * - Sunday: 6:00 PM ET - Friday 5:00 PM ET (nearly 24/5)
 * - Daily maintenance break: 5:00 PM - 6:00 PM ET
 * - Weekend: Friday 5:00 PM ET - Sunday 6:00 PM ET (closed)
 */

export interface MarketStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'pre-market' | 'after-hours';
  nextOpen?: Date;
  nextClose?: Date;
  message: string;
}

/**
 * Check if futures markets are currently open
 * Uses US Eastern Time for CME market hours
 */
export function getMarketStatus(): MarketStatus {
  const now = new Date();
  
  // Convert to US Eastern Time
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // Market closed on Saturdays and most of Sunday
  if (dayOfWeek === 6) {
    // Saturday - market closed all day
    return {
      isOpen: false,
      status: 'closed',
      message: 'Markets closed (Weekend)',
    };
  }

  if (dayOfWeek === 0) {
    // Sunday - market opens at 6:00 PM ET
    if (currentMinutes < 18 * 60) {
      return {
        isOpen: false,
        status: 'closed',
        message: 'Markets closed (Weekend)',
      };
    }
    return {
      isOpen: true,
      status: 'open',
      message: 'Markets open',
    };
  }

  // Monday - Thursday: Check for daily maintenance break (5:00 PM - 6:00 PM ET)
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    if (currentMinutes >= 17 * 60 && currentMinutes < 18 * 60) {
      return {
        isOpen: false,
        status: 'closed',
        message: 'Daily maintenance break',
      };
    }
    return {
      isOpen: true,
      status: 'open',
      message: 'Markets open',
    };
  }

  // Friday - market closes at 5:00 PM ET
  if (dayOfWeek === 5) {
    if (currentMinutes >= 17 * 60) {
      return {
        isOpen: false,
        status: 'closed',
        message: 'Markets closed (Weekend)',
      };
    }
    // Check for maintenance break before close
    if (currentMinutes >= 17 * 60 && currentMinutes < 18 * 60) {
      return {
        isOpen: false,
        status: 'closed',
        message: 'Daily maintenance break',
      };
    }
    return {
      isOpen: true,
      status: 'open',
      message: 'Markets open',
    };
  }

  // Default to closed if something unexpected
  return {
    isOpen: false,
    status: 'closed',
    message: 'Market status unavailable',
  };
}

/**
 * Check if it's currently a weekend
 */
export function isWeekend(): boolean {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = etTime.getDay();
  const hours = etTime.getHours();
  
  // Saturday
  if (dayOfWeek === 6) return true;
  
  // Sunday before 6 PM ET
  if (dayOfWeek === 0 && hours < 18) return true;
  
  // Friday after 5 PM ET
  if (dayOfWeek === 5 && hours >= 17) return true;
  
  return false;
}

/**
 * Get next market open time
 */
export function getNextMarketOpen(): Date {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = etTime.getDay();
  const hours = etTime.getHours();
  
  const nextOpen = new Date(etTime);
  
  // If it's Saturday, next open is Sunday 6 PM
  if (dayOfWeek === 6) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(18, 0, 0, 0);
  }
  // If it's Sunday before 6 PM, next open is today at 6 PM
  else if (dayOfWeek === 0 && hours < 18) {
    nextOpen.setHours(18, 0, 0, 0);
  }
  // If it's Friday after 5 PM, next open is Sunday 6 PM
  else if (dayOfWeek === 5 && hours >= 17) {
    nextOpen.setDate(nextOpen.getDate() + (7 - dayOfWeek)); // Move to Sunday
    nextOpen.setHours(18, 0, 0, 0);
  }
  // During maintenance break, next open is in 1 hour (6 PM)
  else if (hours === 17) {
    nextOpen.setHours(18, 0, 0, 0);
  }
  
  return nextOpen;
}
