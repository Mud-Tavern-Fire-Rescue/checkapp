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
