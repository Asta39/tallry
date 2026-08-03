"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type ChangeHandlers<T extends Record<string, any>> = {
  onInsert?: (row: T) => void;
  onUpdate?: (row: T, oldRow: Partial<T>) => void;
  onDelete?: (oldRow: Partial<T>) => void;
  /**
   * Called whenever a change can't be applied confidently — e.g. the
   * channel dropped and resubscribed (missed events in between), or a
   * payload came through with a shape the caller doesn't recognize.
   * Callers should refetch the affected list from the server here rather
   * than risk stale/incorrect local state.
   */
  onUnreliable?: () => void;
};

type Listener = ChangeHandlers<any>;

type Registration = {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
};

// Module-level registry so two components subscribing to the same
// (table, org) — e.g. a notification badge in the header and the full
// notifications list on a page — share exactly one Postgres Realtime
// channel instead of opening a duplicate subscription each. The channel is
// only torn down once its last listener unmounts.
const registry = new Map<string, Registration>();

function getOrCreateChannel(table: string, column: string, value: string | number): Registration {
  const key = `rt:${table}:${column}=${value}`;
  const existing = registry.get(key);
  if (existing) return existing;

  const supabase = createClient();
  const listeners = new Set<Listener>();
  const channel = supabase
    .channel(key)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `${column}=eq.${value}` },
      (payload: RealtimePostgresChangesPayload<any>) => {
        for (const l of listeners) {
          try {
            if (payload.eventType === "INSERT") l.onInsert?.(payload.new);
            else if (payload.eventType === "UPDATE") l.onUpdate?.(payload.new, payload.old);
            else if (payload.eventType === "DELETE") l.onDelete?.(payload.old);
            else l.onUnreliable?.();
          } catch {
            // A handler that throws on a malformed/unexpected payload means
            // that listener's local state may now be inconsistent — let it
            // resync from source rather than risk showing stale data.
            l.onUnreliable?.();
          }
        }
      }
    )
    .subscribe((status: `${REALTIME_SUBSCRIBE_STATES}`) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        for (const l of listeners) l.onUnreliable?.();
      }
    });

  const reg = { channel, listeners };
  registry.set(key, reg);
  return reg;
}

function releaseChannel(table: string, column: string, value: string | number, listener: Listener) {
  const key = `rt:${table}:${column}=${value}`;
  const reg = registry.get(key);
  if (!reg) return;
  reg.listeners.delete(listener);
  if (reg.listeners.size === 0) {
    createClient().removeChannel(reg.channel);
    registry.delete(key);
  }
}

/**
 * Subscribes to Postgres change events for one table, scoped to a single
 * organization via the same `org_id = <orgId>` filter enforced server-side
 * by RLS (see migration.sql) — the filter here is a convenience to avoid
 * shipping other orgs' payloads over the wire, not the security boundary.
 * Duplicate mounts against the same (table, filter) share one underlying
 * channel; cleans up automatically on unmount.
 */
export function useRealtimeTable<T extends Record<string, any> = Record<string, any>>(
  table: string,
  filter: { column: string; value: string | number } | null,
  handlers: ChangeHandlers<T>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!filter || filter.value == null) return;
    const { column, value } = filter;

    // Stable proxy object registered with the shared channel — always
    // dispatches to whatever handlers this render currently holds, so the
    // effect doesn't need to re-subscribe every time a handler identity changes.
    const listener: Listener = {
      onInsert: (row) => handlersRef.current.onInsert?.(row),
      onUpdate: (row, old) => handlersRef.current.onUpdate?.(row, old),
      onDelete: (old) => handlersRef.current.onDelete?.(old),
      onUnreliable: () => handlersRef.current.onUnreliable?.(),
    };

    const reg = getOrCreateChannel(table, column, value);
    reg.listeners.add(listener);

    return () => releaseChannel(table, column, value, listener);
  }, [table, filter?.column, filter?.value]);
}
