import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import { ZenoHero } from "@/components/ZenoHero";
import { ZenoShowcase } from "@/components/ZenoShowcase";
import { ZenoAI } from "@/components/ZenoAI";
import { ZenoPricing } from "@/components/ZenoPricing";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/home");

  // Returning visitor (has signed in/up on this device before) but no active
  // session right now — skip the marketing pitch and go straight to login.
  const cookieStore = await cookies();
  if (cookieStore.get("zeno_returning")) redirect("/login");

  return (
    <main>
      <ZenoHero />
      <ZenoShowcase />
      <ZenoAI />
      <ZenoPricing />
    </main>
  );
}
