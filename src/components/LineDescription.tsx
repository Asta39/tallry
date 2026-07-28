/**
 * Item name above its description, mirroring the PDF layout.
 *
 * Picking a catalog item seeds the line's description with the item name, which
 * the user then usually replaces with the specifics ("1.2 by 2.1m") — so showing
 * the description alone loses what was actually sold. When the two are still
 * identical, or the line was typed freehand with no item behind it, only one
 * line renders so nothing reads as duplicated.
 */
export function LineDescription({
  itemName,
  description,
}: {
  itemName?: string | null;
  description?: string | null;
}) {
  const name = itemName?.trim();
  const desc = description?.trim();
  const showBoth = !!name && !!desc && name.toLowerCase() !== desc.toLowerCase();

  if (!showBoth) return <>{name || desc}</>;

  return (
    <>
      <span className="font-medium">{name}</span>
      <div className="text-[12px] text-[var(--color-ink-500)] mt-0.5">{desc}</div>
    </>
  );
}
