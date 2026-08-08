/** Gateway provider refs are long UUIDs (Kopo Kopo) or verbose conversation
 *  ids (Daraja) — unreadable in an SMS or on a receipt. Compress to the last
 *  8 alphanumeric characters, uppercased, as a short code the accountant can
 *  actually read back or note down; still specific enough per payout to be
 *  useful for a quick "does this match what I see" check. Kept in its own
 *  plain (non "use server") module so it can be imported from both the SMS
 *  copy and the payment record without violating the server-actions-only
 *  export rule in payout-notify.ts. */
export function shortRef(providerRef: string): string {
  const alnum = (providerRef || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return alnum.slice(-8) || providerRef;
}
