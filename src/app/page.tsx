import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ZenoHero } from "@/components/ZenoHero";
import { ZenoShowcase } from "@/components/ZenoShowcase";
import { ZenoAI } from "@/components/ZenoAI";
import { ZenoPricing } from "@/components/ZenoPricing";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/home");

  return (
    <main>
      <ZenoHero />
      <ZenoShowcase />
      <ZenoAI />
      <ZenoPricing />
    </main>
  );
}
