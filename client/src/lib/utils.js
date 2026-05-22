import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Convert decimal hour (e.g., 17.5 for 5:30 PM) to 12-hour AM/PM format
export function formatTime(decimalHour) {
  if (decimalHour === undefined || decimalHour === null) return "";

  const hour = Math.floor(decimalHour);
  const minute = Math.round((decimalHour - hour) * 60);

  const hour12 = hour % 12 || 12;
  const meridiem = hour >= 12 ? "PM" : "AM";

  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

export const isIframe = window.self !== window.top;
