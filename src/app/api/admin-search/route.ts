import { NextResponse } from "next/server";
import { db, org } from "@/db";
import { ilike, or } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    await requireSuperAdmin();

    const rows = await db
      .select({ id: org.id, name: org.name, email: org.email, phone: org.phone })
      .from(org)
      .where(or(ilike(org.name, `%${q}%`), ilike(org.email, `%${q}%`), ilike(org.phone, `%${q}%`)))
      .limit(8);

    const results = rows.map((r) => ({
      type: "org",
      title: r.name || `Org #${r.id}`,
      subtitle: [r.email, r.phone].filter(Boolean).join(" · ") || `Org #${r.id}`,
      href: `/admin/orgs/${r.id}`,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
