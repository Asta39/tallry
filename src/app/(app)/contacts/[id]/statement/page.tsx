import { withOrg } from "@/lib/org";
import { getStatementData } from "@/lib/phase-a-actions";
import { todayISO } from "@/lib/money";
import { addDays } from "@/lib/recurring";
import { PageHeader } from "@/components/ui";
import { StatementViewer } from "./StatementViewer"; // We will create this as a client component

export const dynamic = "force-dynamic";

export default async function ContactStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const contactId = Number(id);

  // default to last 30 days
  const dateTo = to || todayISO();
  const dateFrom = from || addDays(dateTo, -30);

  const data = await getStatementData(contactId, dateFrom, dateTo);

  return (
    <>
      <PageHeader 
        title={`Statement: ${data.contact.name}`} 
        subtitle={`Period: ${dateFrom} to ${dateTo}`}
        backLink={`/contacts/${contactId}`}
      />
      <div className="card mt-6 h-[800px] overflow-hidden">
        <StatementViewer data={data} from={dateFrom} to={dateTo} />
      </div>
    </>
  );
}
