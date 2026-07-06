import { DocDetail } from "@/components/DocDetail";

export const dynamic = "force-dynamic";

export default async function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocDetail id={Number(id)} />;
}
