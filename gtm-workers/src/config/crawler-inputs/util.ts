// get date of 30 days ago (UTC) formatted like ""YYYY-MM-DD"
// example: "2026-03-12"
export function getPostDateLimit(daysAgoFromToday: number): string {
  if (daysAgoFromToday < 0 || !Number.isInteger(daysAgoFromToday)) {
    throw new Error("daysAgoFromToday must be a positive number");
  }
  const date = new Date();
  date.setDate(date.getDate() - daysAgoFromToday);
  return date.toISOString().split('T')[0]!;
}