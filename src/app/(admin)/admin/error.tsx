"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

/** Admin page errors stay inside the admin shell (sidebar still usable). */
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} where="Admin" />;
}
