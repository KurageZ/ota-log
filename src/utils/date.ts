export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toISODateTime(): string {
  return new Date().toISOString();
}

export function formatDate(isoDate: string): string {
  return isoDate;
}

export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

/**
 * 用于 `event_date LIKE ? || '-%'` 的参数。
 * 全年：`"2024"`（匹配 `2024-%`）；某月：`"2024-05"`（匹配 `2024-05-%`，月份补零）。
 */
export function eventDateLikeParam(year: number, month?: number | null): string {
  if (month == null) return String(year);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * 用于 cheki `strftime('%Y-%m', COALESCE(date, created_at)) LIKE ?` 的参数。
 * 全年：`"2024-%"`（匹配该年任意月）；某月：`"2024-05"`（精确匹配该月）。
 */
export function periodLikeParam(year: number, month?: number | null): string {
  if (month == null) return `${year}-%`;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
