import { requirePerm } from "@/lib/guard";
import { listWarehouses } from "@/lib/warehouses";
import { PageHeader } from "@/components/ui";
import { WarehousesClient } from "./WarehousesClient";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  await requirePerm("items");
  const warehouses = await listWarehouses();

  return (
    <>
      <PageHeader title="Warehouses" subtitle="Manage stock locations. Add a second one to unlock the warehouse picker on bills and invoices." />
      <WarehousesClient warehouses={warehouses} />
    </>
  );
}
