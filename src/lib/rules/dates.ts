/**
 * Working-day arithmetic. Public holidays are passed in (they change every year and by state),
 * so nothing is hardcoded here. Weekends default to Sunday only because most print shops
 * work Saturdays; pass [0, 6] for Sat+Sun, or [5, 6] for Fri+Sat states.
 */
export function addWorkingDays(
  startISO: string,
  days: number,
  opts: { holidays?: string[]; weekendDays?: number[] } = {},
): string {
  const holidays = new Set(opts.holidays ?? []);
  const weekend = new Set(opts.weekendDays ?? [0]);
  const d = new Date(`${startISO}T00:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (!weekend.has(d.getUTCDay()) && !holidays.has(iso)) left--;
  }
  return d.toISOString().slice(0, 10);
}
