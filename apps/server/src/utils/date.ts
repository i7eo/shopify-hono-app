export function now(options: { type: "date" | "time"; timeZone: string }) {
  const { type, timeZone = "Asia/Shanghai" } = options;
  // avoid server utc date shift
  const now = new Date(new Date().toLocaleString("en-US", { timeZone }));

  if (type === "date") {
    // "YYYY-MM-DD"
    return now.toISOString().slice(0, 10);
  }

  return now.getTime();
}
