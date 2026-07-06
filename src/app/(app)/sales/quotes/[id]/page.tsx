import { DocDetail } from "@/components/DocDetail";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("quotes");
  const { id } = await params;
  return <DocDetail id={Number(id)} />;
}
