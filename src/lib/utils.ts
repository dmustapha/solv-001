// Guard: true only if value is a real Arc tx hash (0x + 64 hex chars)
// Filters out Circle UUIDs, "0x0", and other non-hash strings
export function isArcTxHash(value: string | null | undefined): value is `0x${string}` {
  if (!value) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}
