import { NextRequest } from "next/server";

/**
 * Demo CSV templates matching the import schema exactly.
 * GET /api/csv-template?entity=contacts|items|invoices
 */

const templates: Record<string, string[][]> = {
  contacts: [
    ["kind", "name", "company", "email", "phone", "kra_pin", "address", "city"],
    ["customer", "Acme Distributors Ltd", "Acme Distributors Ltd", "accounts@acme.co.ke", "+254722000111", "P051111111A", "P.O. Box 100", "Nairobi"],
    ["vendor", "Simba Suppliers", "", "sales@simba.co.ke", "+254733222333", "P052222222B", "", "Mombasa"],
    ["both", "Jengo Hardware", "", "", "+254711444555", "", "", "Nakuru"],
  ],
  items: [
    ["type", "name", "sku", "unit", "selling_price", "buying_cost", "vat_class", "track_stock", "reorder_level"],
    ["service", "Consulting (hourly)", "", "hour", "5000.00", "0", "B16", "no", "0"],
    ["goods", "Branded T-Shirt", "TS-001", "pc", "1200.00", "700.00", "B16", "yes", "10"],
    ["goods", "Maize Flour 2kg", "MF-2KG", "pc", "210.00", "180.00", "C0", "yes", "50"],
  ],
  invoices: [
    ["invoice_ref", "customer_name", "date", "due_date", "description", "qty", "unit_price", "discount_pct", "vat_class"],
    ["INV-A", "Acme Distributors Ltd", "2026-07-01", "2026-07-31", "Consulting (hourly)", "8", "5000.00", "0", "B16"],
    ["INV-A", "Acme Distributors Ltd", "2026-07-01", "2026-07-31", "Branded T-Shirt", "20", "1200.00", "5", "B16"],
    ["INV-B", "Jengo Hardware", "2026-07-02", "", "Delivery service", "1", "3500.00", "0", "B16"],
  ],
};

const notes: Record<string, string> = {
  contacts: "# kind: customer | vendor | both. Name required; duplicates (same name) are skipped.",
  items: "# type: service | goods. vat_class: B16 (16%) | C0 (zero-rated) | A_EXEMPT | D_NONVAT. track_stock: yes | no. Prices in KSh.",
  invoices: "# Rows with the same invoice_ref become ONE invoice (multi-line). Imported as DRAFTS — review and issue in the app. Dates YYYY-MM-DD. Prices in KSh before VAT.",
};

export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get("entity") ?? "";
  const t = templates[entity];
  if (!t) return new Response("Unknown entity", { status: 400 });
  const csv = `${notes[entity]}\n` + t.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c}"` : c)).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zeno-${entity}-template.csv"`,
    },
  });
}
