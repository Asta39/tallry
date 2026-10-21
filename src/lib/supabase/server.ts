import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components can't set cookies; middleware handles refresh
          }
        },
      },
    }
  );
}

/** Asks Supabase Auth who's signed in (a network round trip). */
async function getUserUncached() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    // Next's own control-flow errors (DYNAMIC_SERVER_USAGE while prerendering,
    // redirects, not-found) must propagate — swallowing them here made a
    // statically-attempted page look like "no user" and logged a scary
    // build-time "getUser error" instead of switching the route to dynamic.
    unstable_rethrow(err);
    console.error("getUser error:", err);
    return null;
  }
}

/**
 * Returns the currently signed-in user, or null. Memoized per request: the
 * layout, getOrg, getAccess and the super-admin checks all ask, and each ask
 * was a separate round trip to Supabase Auth.
 */
export const getUser = cache(getUserUncached);
