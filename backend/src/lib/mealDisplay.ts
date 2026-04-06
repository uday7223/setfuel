export function formatMealTime(d: Date): string {
  return d
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
}
