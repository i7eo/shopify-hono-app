import dayjs from "dayjs";
import { isDate } from "es-toolkit";

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DATE_FORMAT = "YYYY-MM-DD";

export function formatToDateTime(
  date: string | number | Date | dayjs.Dayjs | null | undefined = undefined,
  format = DATE_TIME_FORMAT,
): string {
  return dayjs(date).format(format);
}

export function formatToDate(
  date: string | number | Date | dayjs.Dayjs | null | undefined = undefined,
  format = DATE_FORMAT,
): string {
  return dayjs(date).format(format);
}

export function isDateObject(obj: unknown): boolean {
  return isDate(obj) || dayjs.isDayjs(obj);
}

export function diffDays(date: string, previousDate: string) {
  return dayjs(date).diff(dayjs(previousDate), "day");
}

export function previousDay(date: string) {
  const d = dayjs(date); // 或任意 Date / 时间戳 / ISO 字符串
  const previousDay = d.subtract(1, "day");
  return previousDay.format(DATE_FORMAT);
}
