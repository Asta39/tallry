"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Catches errors in route layouts (e.g. the admin or app layout) before
 *  they fall through to the bare global error page. */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} where="Root" fullPage />;
}
