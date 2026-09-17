export type DateValue = Date | string | number | null | undefined;

export function safeDate(value: DateValue): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: DateValue,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  const date = safeDate(value);
  return date ? date.toLocaleDateString("en-US", options) : fallback;
}

export function formatDateTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  },
  fallback = "—",
): string {
  const date = safeDate(value);
  return date ? date.toLocaleString("en-US", options) : fallback;
}

export function formatTime(
  value: DateValue,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  fallback = "—",
): string {
  const date = safeDate(value);
  return date ? date.toLocaleTimeString([], options) : fallback;
}