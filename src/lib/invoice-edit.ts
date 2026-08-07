import type { Access } from "@/lib/access";

/** Off (default): anyone with invoices access can edit an issued invoice.
 *  On: only the owner, or a role explicitly listed in issuedInvoiceEditRoles. */
export function canEditIssuedInvoice(
  access: Pick<Access, "isOwner" | "role"> | null,
  org: { restrictIssuedInvoiceEdit: boolean; issuedInvoiceEditRoles: string | null }
): boolean {
  if (!access) return false;
  if (access.isOwner || access.role === "admin") return true;
  if (!org.restrictIssuedInvoiceEdit) return true;
  let roles: string[] = [];
  try {
    roles = JSON.parse(org.issuedInvoiceEditRoles || "[]");
  } catch {
    roles = [];
  }
  return roles.includes(access.role);
}
