export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCplSync } = await import("./lib/cpl-schedule.ts");
    startCplSync();
  }
}
