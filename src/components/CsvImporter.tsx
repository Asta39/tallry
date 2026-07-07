"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseKES } from "@/lib/money";
import {
  importContacts,
  importItems,
  importInvoices,
  type ContactRow,
  type ItemRow,
  type InvoiceRow,
} from "@/lib/import-actions";

/**
 * CSV importer for contacts / items / invoices.
 * "Download template" gives a demo CSV whose columns match the DB import
 * schema; user fills it, uploads, previews, imports.
 */

function splitCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

function indexHeaders(header: string[]) {
  const h = header.map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "_"));
  return (...names: string[]) => h.findIndex((c) => names.includes(c));
}

const yes = (v: string) => ["yes", "y", "true", "1"].includes((v || "").toLowerCase());

type Entity = "contacts" | "items" | "invoices";

export function CsvImporter({ entity, label }: { entity: Entity; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ count: number; sample: string[]; rows: unknown[] } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null); setResult(null); setPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const grid = splitCsv(await file.text());
    if (grid.length < 2) return setError("File has no data rows.");
    const idx = indexHeaders(grid[0]);
    const body = grid.slice(1);

    try {
      if (entity === "contacts") {
        const iKind = idx("kind"), iName = idx("name", "display_name"), iCompany = idx("company", "company_name"),
          iEmail = idx("email"), iPhone = idx("phone"), iPin = idx("kra_pin", "pin"), iAddr = idx("address"), iCity = idx("city");
        if (iName < 0) throw new Error('Missing "name" column — download the template.');
        const rows: ContactRow[] = body.map((r) => ({
          kind: r[iKind] ?? "customer",
          displayName: r[iName] ?? "",
          companyName: r[iCompany], email: r[iEmail], phone: r[iPhone],
          kraPin: r[iPin], address: r[iAddr], city: r[iCity],
        })).filter((r) => r.displayName);
        setPreview({ count: rows.length, sample: rows.slice(0, 5).map((r) => `${r.displayName} (${r.kind})`), rows });
      } else if (entity === "items") {
        const iType = idx("type", "kind"), iName = idx("name"), iSku = idx("sku"), iUnit = idx("unit"),
          iSell = idx("selling_price", "sale_price", "price"), iBuy = idx("buying_cost", "purchase_cost", "cost"),
          iVat = idx("vat_class", "tax_class"), iTrack = idx("track_stock", "track_inventory"), iReorder = idx("reorder_level");
        if (iName < 0 || iSell < 0) throw new Error('Missing "name" / "selling_price" columns — download the template.');
        const rows: ItemRow[] = body.map((r) => ({
          kind: r[iType] ?? "service",
          name: r[iName] ?? "",
          sku: r[iSku], unit: r[iUnit],
          salePriceCents: parseKES(r[iSell] ?? "") || 0,
          purchaseCostCents: parseKES(r[iBuy] ?? "") || 0,
          taxClass: r[iVat] || "B16",
          trackInventory: yes(r[iTrack] ?? ""),
          reorderLevel: Number(r[iReorder]) || 0,
        })).filter((r) => r.name);
        setPreview({ count: rows.length, sample: rows.slice(0, 5).map((r) => r.name), rows });
      } else {
        const iRef = idx("invoice_ref", "ref", "number"), iCust = idx("customer_name", "customer"),
          iDate = idx("date"), iDue = idx("due_date"), iDesc = idx("description", "item"),
          iQty = idx("qty", "quantity"), iPrice = idx("unit_price", "price"), iDisc = idx("discount_pct", "discount"),
          iVat = idx("vat_class", "tax_class");
        if (iCust < 0 || iDesc < 0 || iPrice < 0) throw new Error('Missing "customer_name" / "description" / "unit_price" columns — download the template.');
        const rows: InvoiceRow[] = body.map((r) => ({
          invoiceRef: r[iRef] ?? "",
          customerName: r[iCust] ?? "",
          date: r[iDate], dueDate: r[iDue],
          description: r[iDesc] ?? "",
          qty: Number(r[iQty]) || 1,
          unitPriceCents: parseKES(r[iPrice] ?? "") || 0,
          discountPct: Number(r[iDisc]) || 0,
          taxClass: r[iVat] || "B16",
        })).filter((r) => r.customerName && r.description);
        const invoiceCount = new Set(rows.map((r) => r.invoiceRef || Math.random())).size;
        setPreview({ count: rows.length, sample: [...new Set(rows.map((r) => `${r.invoiceRef || "?"} — ${r.customerName}`))].slice(0, 5), rows });
        setResult(null);
        if (rows.length) setError(null);
        void invoiceCount;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse file");
    }
  }

  function runImport() {
    if (!preview) return;
    start(async () => {
      try {
        let res: { created: number; skipped: number };
        if (entity === "contacts") res = await importContacts(preview.rows as ContactRow[]);
        else if (entity === "items") res = await importItems(preview.rows as ItemRow[]);
        else res = await importInvoices(preview.rows as InvoiceRow[]);
        setResult(
          `✓ Imported ${res.created} ${entity === "invoices" ? "draft invoice(s)" : entity}` +
          (res.skipped ? ` · ${res.skipped} skipped (duplicates/empty)` : "")
        );
        setPreview(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="no-print">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2"
      >
        Import CSV
      </button>

      {open && (
        <div className="card p-4 mt-3">
          <div className="flex items-center gap-3 flex-wrap text-[13px]">
            <span className="font-medium">{label}</span>
            <a
              href={`/api/csv-template?entity=${entity}`}
              className="text-[var(--color-accent-600)] font-medium hover:text-[var(--color-accent-700)]"
            >
              ↓ Download template
            </a>
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-[12.5px]" />
          </div>
          <p className="text-[11.5px] text-[var(--color-ink-400)] mt-1.5">
            Fill the template, keep the header row, upload. {entity === "invoices" && "Rows sharing an invoice_ref become one multi-line invoice, imported as a draft."}
          </p>

          {error && <div className="mt-3 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
          {result && <div className="mt-3 text-[12.5px] text-[var(--color-good)] font-medium">{result}</div>}

          {preview && (
            <div className="mt-3">
              <div className="text-[12.5px] text-[var(--color-ink-600)]">
                {preview.count} rows ready · {preview.sample.join(" · ")}{preview.count > 5 ? " …" : ""}
              </div>
              <button
                onClick={runImport}
                disabled={pending}
                className="mt-2 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
              >
                {pending ? "Importing…" : `Import ${preview.count} rows`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
