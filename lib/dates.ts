/** Dates are stored as YYYY-MM-DD and shown as written, with no time-zone shift. */
const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const monthDay = (iso: string) =>
  parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const weekday = (iso: string) => parse(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

export const longDate = (iso: string) =>
  parse(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });



/** "19:30" → "7:30 PM" */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
