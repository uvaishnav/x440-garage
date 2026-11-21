/** Returns a calendar date in the user's local timezone (YYYY-MM-DD). */
export function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDateTimeValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${localDateInputValue(date)}T${hours}:${minutes}`;
}

export function daysUntil(dateValue: string, from = new Date()): number | null {
  if (!dateValue) return null;
  const target = new Date(`${dateValue}T00:00:00`);
  const origin = new Date(from);
  origin.setHours(0, 0, 0, 0);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - origin.getTime()) / 86_400_000);
}
