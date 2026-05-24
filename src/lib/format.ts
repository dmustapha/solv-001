/**
 * Shared formatting utilities.
 * Single source of truth — do not re-implement in components.
 */

/**
 * Format a USDC amount for display.
 * @param n      — raw number
 * @param places — decimal places (default 2 for user-facing, pass 4 for treasury detail)
 */
export function formatUSDC(n: number, places = 2): string {
  return `$${n.toFixed(places)}`;
}

/** Returns true if a string is valid JSON. */
export function isJsonBlob(s: string): boolean {
  try { JSON.parse(s); return true; } catch { return false; }
}
