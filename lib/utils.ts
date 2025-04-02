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