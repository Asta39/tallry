import crypto from "crypto";
import { db, approvalRequestTokens, documents, org } from "@/db";
import { and, eq } from "drizzle-orm";
import type { Access } from "@/lib/access";
import { appOrigin } from "@/lib/receipts/tokens";
import { fmtKES, nowISO } from "@/lib/money";
import { getOrgSmsConfig, normalizeKePhone, sendSms } from "@/lib/sms";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateToken(length = 16): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

export function isSpendApprovalType(type: string): type is "bill" | "expense" {
  return type === "bill" || type === "expense";
}

export function canApproveSpend(params: {
  access: Pick<Access, "isOwner" | "role"> | null;
  totalCents: number;
  accountantApprovalLimitCents: number | null | undefined;
}): boolean {
  if (!params.access) return false;
  if (params.access.isOwner || params.access.role === "admin") return true;
  if (params.access.role !== "accountant") return false;
  if (params.accountantApprovalLimitCents == null) return true;
  return params.totalCents <= params.accountantApprovalLimitCents;
}

export function approvalRequestRecipient(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  return normalizeKePhone(rawPhone);
}

export async function createApprovalRequestToken(orgId: number, documentId: number, recipient?: string | null): Promise<string> {
  await db
    .update(approvalRequestTokens)
    .set({ revoked: true })
    .where(and(eq(approvalRequestTokens.orgId, orgId), eq(approvalRequestTokens.documentId, documentId), eq(approvalRequestTokens.revoked, false)));

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = generateToken();
    const [row] = await db
      .insert(approvalRequestTokens)
      .values({
        orgId,
        documentId,
        token,
        channel: "sms",
        recipient: recipient || null,
        createdAt: nowISO(),
      })
      .onConflictDoNothing()
      .returning({ token: approvalRequestTokens.token });
    if (row) return row.token;
  }
  throw new Error("Failed to create approval request token");
}

export async function approvalRequestUrl(token: string): Promise<string> {
  return `${await appOrigin()}/approve/${token}`;
}

export async function sendSpendApprovalSms(documentId: number): Promise<{ sent: boolean; reason?: string }> {
  const [doc] = await db
    .select({
      id: documents.id,
      orgId: documents.orgId,
      number: documents.number,
      type: documents.type,
      totalCents: documents.totalCents,
      status: documents.status,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc || !isSpendApprovalType(doc.type)) return { sent: false, reason: "Document is not an approvable spend" };
  if (doc.status !== "pending_approval") return { sent: false, reason: "Document is not awaiting approval" };

  const [orgRow] = await db.select().from(org).where(eq(org.id, doc.orgId)).limit(1);
  if (!orgRow) return { sent: false, reason: "Organization not found" };

  const cfg = await getOrgSmsConfig(doc.orgId);
  if (!cfg) return { sent: false, reason: "SMS is not configured" };

  const recipient = approvalRequestRecipient(orgRow.approvalRequestPhone || orgRow.phone);
  if (!recipient) return { sent: false, reason: "No approval phone configured" };

  const token = await createApprovalRequestToken(doc.orgId, doc.id, recipient);
  const url = await approvalRequestUrl(token);
  const result = await sendSms(
    cfg,
    recipient,
    `${orgRow.name || "Zeno"}: ${doc.type === "bill" ? "Bill" : "Expense"} ${doc.number} for ${fmtKES(doc.totalCents)} is awaiting approval. Review: ${url}`
  );
  if (!result.ok) return { sent: false, reason: result.error || "SMS send failed" };
  return { sent: true };
}

export async function getApprovalRequestByToken(token: string) {
  if (!/^[A-Za-z0-9]{10,32}$/.test(token)) return null;
  const [row] = await db
    .select({ req: approvalRequestTokens, doc: documents, orgRow: org })
    .from(approvalRequestTokens)
    .innerJoin(documents, eq(documents.id, approvalRequestTokens.documentId))
    .innerJoin(org, eq(org.id, approvalRequestTokens.orgId))
    .where(and(eq(approvalRequestTokens.token, token), eq(approvalRequestTokens.revoked, false)))
    .limit(1);
  if (!row || row.doc.status !== "pending_approval" || !isSpendApprovalType(row.doc.type)) return null;
  return row;
}

export async function markApprovalTokenUsed(params: {
  tokenId: number;
  orgId: number;
  documentId: number;
  decision: "approved" | "rejected";
  note?: string | null;
}) {
  await db
    .update(approvalRequestTokens)
    .set({
      decision: params.decision,
      note: params.note || null,
      actedAt: nowISO(),
      revoked: true,
    })
    .where(eq(approvalRequestTokens.id, params.tokenId));
  await db
    .update(approvalRequestTokens)
    .set({ revoked: true })
    .where(and(
      eq(approvalRequestTokens.orgId, params.orgId),
      eq(approvalRequestTokens.documentId, params.documentId),
      eq(approvalRequestTokens.revoked, false),
    ));
}
