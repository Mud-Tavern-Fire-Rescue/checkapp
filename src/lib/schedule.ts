import type { CheckFrequency } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// How long a completed check stays current before it shows as Due.
export const FREQUENCY_DAYS: Record<CheckFrequency, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
};

export const FREQUENCY_LABEL: Record<CheckFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export function isDue(
  frequency: CheckFrequency,
  lastSubmittedAt: Date | undefined,
  now: number,
): boolean {
  if (!lastSubmittedAt) return true;
  return now - lastSubmittedAt.getTime() > FREQUENCY_DAYS[frequency] * DAY_MS;
}

// Groups items under their section heading, keeping the order the sections
// first appear in (items are already sorted by sortOrder).
export function groupBySection<T extends { section: string | null }>(
  items: T[],
): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}
