"use client";

import { useState } from "react";

type ItemType = { id: number; name: string; isGroupMandatory: boolean };
type Group = { id: number; name: string; appliesTo: string };

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

/**
 * Type + Item group fields as one client island inside an otherwise plain
 * server-rendered `<form action={serverFn}>` — picking a type whose
 * `isGroupMandatory` is false relaxes the group field's `required` without
 * a full page round-trip. The group can still be set even when optional.
 * Both selects keep their real `name` attributes so FormData submission is
 * unaffected.
 */
export function ItemKindGroupFields({
  types,
  groups,
  orgGroupsEnabled,
  defaultKind,
  defaultGroupId,
}: {
  types: ItemType[];
  groups: Group[];
  orgGroupsEnabled: boolean;
  defaultKind?: string;
  defaultGroupId?: number | "";
}) {
  const [kind, setKind] = useState(defaultKind || types[0]?.name || "");
  const mandatoryForKind = types.find((t) => t.name === kind)?.isGroupMandatory ?? true;
  const groupRequired = orgGroupsEnabled && mandatoryForKind;

  return (
    <>
      <label className="block">
        <span className={label}>Type</span>
        <select name="kind" className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.name}>{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Item group {groupRequired ? "*" : ""}</span>
        {groups.length > 0 ? (
          <select
            name="itemGroupId"
            className={input}
            required={groupRequired}
            defaultValue={defaultGroupId ?? ""}
          >
            <option value="">{groupRequired ? "Select a group" : "No group"}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.appliesTo !== "both" ? ` (${g.appliesTo} only)` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-1 rounded-lg border border-dashed border-[var(--color-ink-200)] px-3 py-2 text-[13px] text-[var(--color-ink-500)]">
            No item groups yet. <a href="/items/groups" className="underline">Manage item groups</a>.
          </div>
        )}
      </label>
    </>
  );
}
