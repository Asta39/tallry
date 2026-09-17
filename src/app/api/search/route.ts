import { NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { runSearch } from "@/lib/search";
import { getRelatedRecords } from "@/lib/related-records";
import type { SearchSection } from "@/lib/search-sections";

export const dynamic = "force-dynamic";

const VALID_SECTIONS = new Set(["contacts", "sales", "purchases", "items", "payroll", "other"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.length < 2) return NextResponse.json({ results: [], related: [] });

    const rawSection = searchParams.get("section") || "other";
    const section: SearchSection = (VALID_SECTIONS.has(rawSection) ? rawSection : "other") as SearchSection;

    const access = await getAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const results = await runSearch(access, q, section);

    // Related suggestions only for a clear top match — an exact hit (e.g.
    // typing an invoice number) — not for a broad, ambiguous result list.
    const top = results[0];
    const related = top?.exactMatch
      ? await getRelatedRecords(access.orgId, top.type, extractIdFromHref(top.href))
      : [];

    return NextResponse.json({ results, related });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function extractIdFromHref(href: string): number {
  const match = href.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}
