import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isWithinTradingHours(): { allowed: boolean; message?: string } {
  // Get current time in Thailand timezone
  const now = new Date();
  const thailandTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  
  const hours = thailandTime.getHours();
  const minutes = thailandTime.getMinutes();
  const currentTime = hours * 100 + minutes; // Convert to HHMM format
  
  // Check if it's a weekend (Saturday = 6, Sunday = 0)
  const day = thailandTime.getDay();
  if (day === 0 || day === 6) {
    return {
      allowed: false,
      message: 'Trading is only available on weekdays (Monday to Friday)'
    };
  }

  // Check if within trading hours (9:30 - 17:00)
  if (currentTime < 930 || currentTime > 1700) {
    return {
      allowed: false,
      message: 'Trading is only available between 9:30 AM and 5:00 PM (Thailand time)'
    };
  }

  return { allowed: true };
}

// Trading status settings (this would typically come from a database)
let tradingSettings = {
  isEnabled: true,
  startTime: '09:30',
  endTime: '17:00',
  weekdaysOnly: true
};

// Function to update trading settings
export function updateTradingSettings(settings: {
  isEnabled?: boolean;
  startTime?: string;
  endTime?: string;
  weekdaysOnly?: boolean;
}) {
  tradingSettings = { ...tradingSettings, ...settings };
  return tradingSettings;
}

// Function to get current trading settings
export function getTradingSettings() {
  return { ...tradingSettings };
}

// Function to check if trading is allowed based on current settings
export function isTradingAllowed(): { allowed: boolean; message?: string } {
  // First check if trading is enabled at all
  if (!tradingSettings.isEnabled) {
    return {
      allowed: false,
      message: 'Trading is currently disabled by the administrator'
    };
  }
  
  // Get current time in Thailand timezone
  const now = new Date();
  const thailandTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  
  // Check if it's a weekend and weekdaysOnly is true
  if (tradingSettings.weekdaysOnly) {
    const day = thailandTime.getDay();
    if (day === 0 || day === 6) {
      return {
        allowed: false,
        message: 'Trading is only available on weekdays (Monday to Friday)'
      };
    }
  }
  
  // Parse trading hours
  const [startHour, startMinute] = tradingSettings.startTime.split(':').map(Number);
  const [endHour, endMinute] = tradingSettings.endTime.split(':').map(Number);
  
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;
  
  const currentHour = thailandTime.getHours();
  const currentMinute = thailandTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  // Check if current time is within trading hours
  if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) {
    return {
      allowed: false,
      message: `Trading is only available between ${tradingSettings.startTime} and ${tradingSettings.endTime} (Thailand time)`
    };
  }
  
  return { allowed: true };
}