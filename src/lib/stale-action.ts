/** Next.js Server Actions are keyed by a build-specific id. A browser tab left
 *  open across a deploy still holds the old id, so its next server action
 *  call 404s with this exact message — not a real app bug, just a stale
 *  bundle. Detect it so the UI can say "refresh the page" instead of
 *  surfacing Next's raw, confusing error text. */
export function isStaleServerActionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Server Action "[^"]*" was not found/i.test(msg) || /Failed to find Server Action/i.test(msg);
}

export const STALE_ACTION_MESSAGE = "This page is out of date (a new version was published). Refresh the page and try again.";
