"use server";

import { destroyClientSession } from "@/lib/client-portal/auth";
import { redirect } from "next/navigation";

export async function logoutAction(orgSlug: string) {
  await destroyClientSession(orgSlug);
  redirect(`/portal/${orgSlug}/login`);
}
