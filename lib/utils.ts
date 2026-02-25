import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: Date | string | number): string {
  const target = new Date(date);
  const now = new Date();

  const diffInSec = Math.floor((now.getTime() - target.getTime()) / 1000);
  const isFuture = diffInSec < 0;
  const absDiff = Math.abs(diffInSec);

  const units = [
    { limit: 60, name: "秒", divisor: 1 },
    { limit: 3600, name: "分钟", divisor: 60 },
    { limit: 86400, name: "小时", divisor: 3600 },
    { limit: 7 * 86400, name: "天", divisor: 86400 },
    { limit: 30 * 86400, name: "周", divisor: 7 * 86400 },
    { limit: 365 * 86400, name: "个月", divisor: 30 * 86400 },
    { limit: Infinity, name: "年", divisor: 365 * 86400 },
  ];

  for (const unit of units) {
    if (absDiff < unit.limit) {
      const val = Math.floor(absDiff / unit.divisor) || 1;
      return isFuture ? `${val}${unit.name}后` : `${val}${unit.name}前`;
    }
  }

  return '';
}