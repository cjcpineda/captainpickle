/** Dates are stored as YYYY-MM-DD and shown as written, with no time-zone shift. */
const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);

export const monthDay = (iso: string) =>
  parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const weekday = (iso: string) => parse(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

export const longDate = (iso: string) =>
  parse(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export const todayIso = () => new Date().toLocaleDateString("en-CA");
