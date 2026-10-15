// The department is in Central time; format on the server with an explicit
// zone so output doesn't depend on where the app is hosted.
export const DEPARTMENT_TIME_ZONE = "America/Chicago";

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DEPARTMENT_TIME_ZONE,
  });
}

// Milliseconds the department's clock is ahead of UTC at a given moment
// (negative for Central time; changes with daylight saving).
function departmentOffsetMs(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEPARTMENT_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Midnight at the start of a "YYYY-MM-DD" day in department time, or null if
// the string isn't a real date.
export function departmentDayStart(day: string): Date | null {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  // Apply the offset, then recompute it at the result in case a daylight
  // saving change falls between the two.
  let start = utcMidnight - departmentOffsetMs(new Date(utcMidnight));
  start = utcMidnight - departmentOffsetMs(new Date(start));
  return new Date(start);
}
