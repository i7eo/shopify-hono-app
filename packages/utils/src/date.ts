import dayjs from "dayjs";
import { isDate } from "es-toolkit";

export const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const DATE_FORMAT = "YYYY-MM-DD";

/**
 * Format a date-like value as a date-time string.
 */
export function formatToDateTime(
  date: string | number | Date | dayjs.Dayjs | null | undefined = undefined,
  format = DATE_TIME_FORMAT,
): string {
  return dayjs(date).format(format);
}

/**
 * Format a date-like value as a date string.
 */
export function formatToDate(
  date: string | number | Date | dayjs.Dayjs | null | undefined = undefined,
  format = DATE_FORMAT,
): string {
  return dayjs(date).format(format);
}

/**
 * Check whether a value is a native Date or a Day.js object.
 */
export function isDateObject(obj: unknown): boolean {
  return isDate(obj) || dayjs.isDayjs(obj);
}

/**
 * Return the whole-day difference between two date strings.
 */
export function diffDays(date: string, previousDate: string) {
  return dayjs(date).diff(dayjs(previousDate), "day");
}

/**
 * Return the previous calendar day formatted as YYYY-MM-DD.
 */
export function previousDay(date: string) {
  const d = dayjs(date);
  const previousDay = d.subtract(1, "day");
  return previousDay.format(DATE_FORMAT);
}
