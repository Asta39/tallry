import { db, contacts, documents } from "@/db";
import { and, eq, ilike } from "drizzle-orm";
import { withOrg } from "@/lib/org";
import type { Access } from "@/lib/access";
import { aging, profitAndLoss, accountBalances, dashboardStats, vatReturn } from "@/lib/reports";
import { stockOnHand } from "@/lib/inventory";
import { todayISO, fmtKES } from "@/lib/money";
import { getDailyBrief } from "./brief";
import { saveDocument, recordPayment, voidDoc, adjustStock, saveContact } from "@/lib/actions";

/**
 * Read-only AI tools — each a thin wrapper over an existing report/query
 * function, run inside withOrg() exactly like a server action so it inherits
 * the same org-scoping every other write/read path uses. No tool here can
 * see across orgs: currentOrgId() inside the wrapped functions enforces it.
 */

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema, passed straight to Gemini
  run: (args: any, access: Access) => Promise<unknown>;
}

export const READ_TOOLS: ToolDef[] = [
  {
    name: "getDailyBrief",
    description: "Get a summary of what needs attention today: overdue invoices, overdue bills, stale untouched drafts, and bills pending approval. Scoped to this staff member's assigned documents, or org-wide for owner/admin.",
    parameters: { type: "object", properties: {} },
    run: async (_args, access) => getDailyBrief(access),
  },
  {
    name: "getOverdueInvoices",
    description: "List overdue customer invoices (unpaid past due date) with amounts and days overdue.",
    parameters: { type: "object", properties: {} },
    run: async () => withOrg(() => aging("invoice", todayISO())),
  },
  {
    name: "getOverdueBills",
    description: "List overdue vendor bills (unpaid past due date) with amounts and days overdue.",
    parameters: { type: "object", properties: {} },
    run: async () => withOrg(() => aging("bill", todayISO())),
  },
  {
    name: "getProfitAndLoss",
    description: "Get income, COGS, inventory adjustments, operating expenses, gross profit and net profit for a date range.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date, YYYY-MM-DD" },
        to: { type: "string", description: "End date, YYYY-MM-DD" },
      },
      required: ["from", "to"],
    },
    run: async (args) => withOrg(() => profitAndLoss(args.from, args.to)),
  },
  {
    name: "getAccountBalances",
    description: "Get every chart-of-accounts balance (debits, credits, net) for an optional date range.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Optional start date, YYYY-MM-DD" },
        to: { type: "string", description: "Optional end date, YYYY-MM-DD" },
      },
    },
    run: async (args) => withOrg(() => accountBalances({ from: args.from, to: args.to })),
  },
  {
    name: "getCashPosition",
    description: "Get today's dashboard rollup: receivables, payables, cash on hand, income/expenses this month, net VAT due.",
    parameters: { type: "object", properties: {} },
    run: async () => withOrg(() => dashboardStats(todayISO())),
  },
  {
    name: "getVatDue",
    description: "Get the VAT return breakdown (output vs input VAT, net due) for a date range.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date, YYYY-MM-DD" },
        to: { type: "string", description: "End date, YYYY-MM-DD" },
      },
      required: ["from", "to"],
    },
    run: async (args) => withOrg(() => vatReturn(args.from, args.to)),
  },
  {
    name: "getStockLevel",
    description: "Get current stock quantity on hand for an item.",
    parameters: {
      type: "object",
      properties: { itemId: { type: "number" } },
      required: ["itemId"],
    },
    run: async (args) => withOrg(() => stockOnHand(args.itemId)),
  },
  {
    name: "searchContacts",
    description: "Search customers/vendors by name.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    run: async (args, access) =>
      withOrg(() =>
        db
          .select({ id: contacts.id, displayName: contacts.displayName, kind: contacts.kind, email: contacts.email, phone: contacts.phone })
          .from(contacts)
          .where(and(eq(contacts.orgId, access.orgId), ilike(contacts.displayName, `%${args.query}%`)))
          .limit(10)
      ),
  },
];

/**
 * Write tools. The chat route NEVER calls these directly — it intercepts a
 * requested write tool call, returns a pendingAction with humanSummary to the
 * client, and only /api/assistant/confirm actually invokes `run()`, after
 * re-checking permission and after the user clicks Confirm. Every run() here
 * goes through the same actions.ts wrapper the rest of the app uses, so it
 * gets the same validation, org-scoping, and (for every tool but
 * adjustStock, now fixed) audit logging any other write already gets.
 */
export interface WriteToolDef extends ToolDef {
  isWrite: true;
  requiredPerm: string;
  summarize: (args: any) => string;
}

export const WRITE_TOOLS: WriteToolDef[] = [
  {
    name: "draftInvoice",
    isWrite: true,
    requiredPerm: "invoices",
    description: "Create a DRAFT invoice (not sent/issued — stays editable until a human issues it). Use for 'draft an invoice for X'.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number" },
        date: { type: "string" },
        dueDate: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              unitPriceCents: { type: "number" },
              taxClass: { type: "string", description: "B16 | C0 | A_EXEMPT | D_NONVAT" },
            },
            required: ["description", "qty", "unitPriceCents", "taxClass"],
          },
        },
      },
      required: ["contactId", "date", "lines"],
    },
    summarize: (a) => `Draft invoice for contact #${a.contactId}, ${a.lines?.length ?? 0} line(s), dated ${a.date}`,
    run: async (args) =>
      saveDocument({ type: "invoice", contactId: args.contactId, date: args.date, dueDate: args.dueDate, taxInclusive: false, lines: args.lines }),
  },
  {
    name: "draftQuote",
    isWrite: true,
    requiredPerm: "quotes",
    description: "Create a DRAFT quote. Same shape as draftInvoice.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number" },
        date: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              unitPriceCents: { type: "number" },
              taxClass: { type: "string" },
            },
            required: ["description", "qty", "unitPriceCents", "taxClass"],
          },
        },
      },
      required: ["contactId", "date", "lines"],
    },
    summarize: (a) => `Draft quote for contact #${a.contactId}, ${a.lines?.length ?? 0} line(s), dated ${a.date}`,
    run: async (args) =>
      saveDocument({ type: "quote", contactId: args.contactId, date: args.date, taxInclusive: false, lines: args.lines }),
  },
  {
    name: "draftBill",
    isWrite: true,
    requiredPerm: "bills",
    description: "Create a DRAFT vendor bill.",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "number" },
        date: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              unitPriceCents: { type: "number" },
              taxClass: { type: "string" },
            },
            required: ["description", "qty", "unitPriceCents", "taxClass"],
          },
        },
      },
      required: ["contactId", "date", "lines"],
    },
    summarize: (a) => `Draft bill from contact #${a.contactId}, ${a.lines?.length ?? 0} line(s), dated ${a.date}`,
    run: async (args) =>
      saveDocument({ type: "bill", contactId: args.contactId, date: args.date, taxInclusive: false, lines: args.lines }),
  },
  {
    name: "draftExpense",
    isWrite: true,
    requiredPerm: "expenses",
    description: "Create a DRAFT expense record (not yet paid).",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              unitPriceCents: { type: "number" },
              taxClass: { type: "string" },
            },
            required: ["description", "qty", "unitPriceCents", "taxClass"],
          },
        },
      },
      required: ["date", "lines"],
    },
    summarize: (a) => `Draft expense dated ${a.date}, ${a.lines?.length ?? 0} line(s)`,
    run: async (args) => saveDocument({ type: "expense", date: args.date, taxInclusive: false, lines: args.lines }),
  },
  {
    name: "recordPayment",
    isWrite: true,
    requiredPerm: "invoices",
    description: "Record a payment received against an invoice, or paid against a bill.",
    parameters: {
      type: "object",
      properties: {
        documentId: { type: "number" },
        direction: { type: "string", description: "'in' for customer payment, 'out' for vendor payment" },
        amountCents: { type: "number" },
        method: { type: "string", description: "mpesa | bank | cash | card | cheque" },
        date: { type: "string" },
        reference: { type: "string" },
      },
      required: ["documentId", "direction", "amountCents", "method", "date"],
    },
    summarize: (a) => `Record ${a.direction === "out" ? "payment to" : "payment of"} ${fmtKES(a.amountCents)} via ${a.method} against document #${a.documentId}`,
    run: async (args) =>
      recordPayment({
        documentId: args.documentId,
        direction: args.direction,
        amountCents: args.amountCents,
        method: args.method,
        date: args.date,
        reference: args.reference,
      }),
  },
  {
    name: "voidDocument",
    isWrite: true,
    requiredPerm: "invoices",
    description: "Void a document (invoice, bill, quote, etc). High-risk, irreversible — reverses any ledger postings.",
    parameters: {
      type: "object",
      properties: { documentId: { type: "number" } },
      required: ["documentId"],
    },
    summarize: (a) => `Void document #${a.documentId} — this cannot be undone`,
    run: async (args) => voidDoc(args.documentId),
  },
  {
    name: "adjustStock",
    isWrite: true,
    requiredPerm: "items",
    description: "Adjust stock quantity for an item (found stock, damage, count correction).",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "number" },
        qtyDelta: { type: "number", description: "Positive to add stock, negative to remove" },
        unitCostCents: { type: "number" },
        reason: { type: "string" },
      },
      required: ["itemId", "qtyDelta", "unitCostCents", "reason"],
    },
    summarize: (a) => `${a.qtyDelta > 0 ? "Add" : "Remove"} ${Math.abs(a.qtyDelta)} units of item #${a.itemId} — ${a.reason}`,
    run: async (args) => adjustStock(args.itemId, args.qtyDelta, args.unitCostCents, args.reason),
  },
  {
    name: "createContact",
    isWrite: true,
    requiredPerm: "contacts",
    description: "Create a new customer or vendor contact.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", description: "customer | vendor | both" },
        displayName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        groupIds: { type: "array", items: { type: "number" }, description: "Required (>=1) if kind is customer or both" },
      },
      required: ["kind", "displayName"],
    },
    summarize: (a) => `Create ${a.kind} "${a.displayName}"`,
    run: async (args) => saveContact({ kind: args.kind, displayName: args.displayName, email: args.email, phone: args.phone, groupIds: args.groupIds }),
  },
];

export const ALL_TOOLS: ToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];

export function findWriteTool(name: string): WriteToolDef | undefined {
  return WRITE_TOOLS.find((t) => t.name === name);
}

/** Best-effort human label for a document, used in confirm-flow summaries. */
export async function documentLabel(documentId: number): Promise<string | undefined> {
  const [doc] = await db.select({ number: documents.number }).from(documents).where(eq(documents.id, documentId)).limit(1);
  return doc?.number;
}
