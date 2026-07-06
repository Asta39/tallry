import { redirect } from "next/navigation";
import { getAccess } from "./access";

/** Page guard: redirects to login if signed out, home if module not allowed. */
export async function requirePerm(key: string) {
  const access = await getAccess();
  if (!access) redirect("/login");
  if (!access.perms.has(key)) redirect("/");
  return access;
}
