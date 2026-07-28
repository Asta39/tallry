import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import server actions directly. We must run this with BIASHARA_ORG_ID env var.
import {
  saveContact,
  saveItem,
  saveDocument,
  recordPayment,
  addActivity,
} from "../src/lib/actions.js";
import { profitAndLoss, balanceSheet, vatReturn } from "../src/lib/reports.js";
import { booksHealth } from "../src/lib/analytics.js";
import { db, employees, statutoryRules, payrollRuns, leaveRecords, payrollAdjustments, loanLedger, payrollRunLineItems } from "../src/db/index.js";
import { runPayrollEngine } from "../src/lib/payroll.js";
import { and, eq } from "drizzle-orm";

const server = new Server(
  {
    name: "biashara-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_contact",
        description: "Create a customer or vendor.",
        inputSchema: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["customer", "vendor", "both"] },
            displayName: { type: "string" },
            companyName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
          required: ["kind", "displayName"],
        },
      },
      {
        name: "create_item",
        description: "Create a good or service to sell/buy.",
        inputSchema: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["service", "goods"] },
            name: { type: "string" },
            salePriceCents: { type: "number" },
            purchaseCostCents: { type: "number" },
            taxClass: { type: "string", enum: ["B16", "C0", "A_EXEMPT", "D_NONVAT"] },
          },
          required: ["kind", "name"],
        },
      },
      {
        name: "create_document",
        description: "Create a quote, invoice, bill, or expense.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["quote", "invoice", "bill", "expense"] },
            contactId: { type: "number" },
            date: { type: "string", description: "YYYY-MM-DD" },
            dueDate: { type: "string", description: "YYYY-MM-DD" },
            status: { type: "string", enum: ["draft", "open", "paid", "closed", "void"] },
            taxInclusive: { type: "boolean" },
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  qty: { type: "number" },
                  unitPriceCents: { type: "number" },
                  taxClass: { type: "string" },
                  itemId: { type: "number" },
                },
                required: ["description", "qty", "unitPriceCents", "taxClass"],
              },
            },
            paidFromBankAccountId: { type: "number", description: "Required if type is expense" },
          },
          required: ["type", "date", "status", "taxInclusive", "lines"],
        },
      },
      {
        name: "record_payment",
        description: "Record a payment against an invoice or bill.",
        inputSchema: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["in", "out"] },
            documentId: { type: "number" },
            date: { type: "string", description: "YYYY-MM-DD" },
            amountCents: { type: "number" },
            method: { type: "string", enum: ["mpesa", "bank", "cash", "card"] },
            bankAccountId: { type: "number" },
          },
          required: ["direction", "documentId", "date", "amountCents", "method", "bankAccountId"],
        },
      },
      {
        name: "log_activity",
        description: "Log an activity like a call or note on a contact.",
        inputSchema: {
          type: "object",
          properties: {
            contactId: { type: "number" },
            kind: { type: "string", enum: ["note", "call", "email", "meeting"] },
            content: { type: "string" },
          },
          required: ["contactId", "kind", "content"],
        },
      },
      {
        name: "get_reports",
        description: "Fetch financial reports (P&L, Balance Sheet, VAT, Books Health).",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["date"],
        },
      },
      {
        name: "run_payroll",
        description: "Run payroll for a given month, computing taxes and deductions.",
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "string", description: "YYYY-MM format, e.g. 2024-07" },
          },
          required: ["month"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (name === "create_contact") {
      const id = await saveContact(args as any);
      return { content: [{ type: "text", text: `Successfully created contact. ID: ${id}` }] };
    }
    
    if (name === "create_item") {
      const payload = {
        kind: args?.kind as "service" | "goods",
        name: args?.name as string,
        salePriceCents: args?.salePriceCents ? Number(args.salePriceCents) : 0,
        purchaseCostCents: args?.purchaseCostCents ? Number(args.purchaseCostCents) : 0,
        taxClass: args?.taxClass as any || "B16",
        trackInventory: false,
        unit: (args?.unit as string) || "unit",
        reorderLevel: 0,
      };
      const id = await saveItem(payload);
      return { content: [{ type: "text", text: `Successfully created item. ID: ${id}` }] };
    }
    
    if (name === "create_document") {
      const payload = {
        type: args?.type as "quote" | "invoice" | "bill" | "expense" | "credit_note" | "purchase_order",
        contactId: args?.contactId as number | undefined,
        date: args?.date as string,
        dueDate: args?.dueDate as string | undefined,
        status: args?.status as string,
        taxInclusive: args?.taxInclusive as boolean,
        notes: "",
        lines: (args?.lines as any[]) || [],
        paidFromBankAccountId: args?.paidFromBankAccountId as number | undefined,
        customColumnValue: "",
      };
      const id = await saveDocument(payload);
      return { content: [{ type: "text", text: `Successfully created ${payload.type}. ID: ${id}` }] };
    }
    
    if (name === "record_payment") {
      const id = await recordPayment({
        direction: args?.direction as "in" | "out",
        documentId: args?.documentId as number,
        date: args?.date as string,
        amountCents: args?.amountCents as number,
        method: args?.method as string,
        bankAccountId: args?.bankAccountId as number,
      });
      return { content: [{ type: "text", text: `Successfully recorded payment. ID: ${id}` }] };
    }
    
    if (name === "log_activity") {
      await addActivity(args?.contactId as number, args?.kind as string, args?.content as string);
      return { content: [{ type: "text", text: `Successfully logged activity.` }] };
    }
    
    if (name === "get_reports") {
      const today = args?.date as string;
      const monthStart = today.slice(0, 8) + "01";
      const [pl, vat, health, sheet] = await Promise.all([
        profitAndLoss(monthStart, today),
        vatReturn(monthStart, today),
        booksHealth(null),
        balanceSheet(today)
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({ pl, vat, health, sheet }, null, 2) }]
      };
    }

    if (name === "run_payroll") {
      const month = args?.month as string;
      const oId = Number(process.env.BIASHARA_ORG_ID);
      const activeEmployees = await db.select().from(employees).where(and(eq(employees.orgId, oId), eq(employees.isActive, true)));
      
      if (activeEmployees.length === 0) {
        return { content: [{ type: "text", text: "No active employees found to run payroll." }] };
      }
      
      const rules = await db.select().from(statutoryRules).where(eq(statutoryRules.orgId, oId));
      const [run] = await db.insert(payrollRuns).values({
        orgId: oId,
        month,
        status: "draft",
        createdAt: new Date().toISOString()
      }).returning();
      
      const leaves = await db.select().from(leaveRecords).where(and(eq(leaveRecords.orgId, oId), eq(leaveRecords.month, month)));
      const adjustments = await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.orgId, oId), eq(payrollAdjustments.correctingRunId, run.id)));
      const loans = await db.select().from(loanLedger).where(and(eq(loanLedger.orgId, oId), eq(loanLedger.status, "active")));
      
      let totalLines = 0;
      for (const emp of activeEmployees) {
        const empLeave = leaves.find(l => l.employeeId === emp.id)?.unpaidDaysCount || 0;
        const empAdjs = adjustments.filter(a => a.employeeId === emp.id).map(a => ({
          amountCents: a.amountCents,
          isTaxable: a.isTaxable,
          isDeduction: a.isDeduction,
          reason: a.reason
        }));
        const empLoans = loans.filter(l => l.employeeId === emp.id).map(l => ({
          amountCents: l.installmentCents,
          loanId: l.id
        }));
        
        const lines = runPayrollEngine({
          employeeId: emp.id,
          basicSalaryCents: emp.basicSalaryCents,
          unpaidLeaveDays: empLeave,
          workingDaysInMonth: 21,
          adjustments: empAdjs,
          loanInstallments: empLoans
        }, rules as any);
        
        for (const line of lines) {
          await db.insert(payrollRunLineItems).values({
            orgId: oId,
            payrollRunId: run.id,
            employeeId: emp.id,
            type: line.type,
            subType: line.subType,
            amountCents: line.amountCents,
            isDeduction: line.isDeduction,
            statutoryRuleId: line.statutoryRuleId
          });
        }
        totalLines += lines.length;
      }
      return { content: [{ type: "text", text: `Successfully ran payroll for ${month}. Employees processed: ${activeEmployees.length}. Lines generated: ${totalLines}. PayrollRun ID: ${run.id}` }] };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  if (!process.env.BIASHARA_ORG_ID) {
    console.error("Missing BIASHARA_ORG_ID environment variable.");
    process.exit(1);
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Biashara MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error running MCP server:", err);
  process.exit(1);
});
