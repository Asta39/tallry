/**
 * Coarse section grouping shared by the sidebar's own navigation structure
 * (Selling / Spending / Payroll / Organization in Sidebar.tsx) and global
 * search — maps a pathname to "what part of the app is the user in" and a
 * search result's record type to the same categories, so results native to
 * the current section can be ranked first without inventing a second,
 * conflicting taxonomy.
 */
export type SearchSection = "contacts" | "sales" | "purchases" | "items" | "payroll" | "other";

export function sectionForPathname(pathname: string): SearchSection {
  if (pathname.startsWith("/contacts")) return "contacts";
  if (pathname.startsWith("/sales") || pathname.startsWith("/pipeline") || pathname.startsWith("/campaigns")) return "sales";
  if (pathname.startsWith("/purchases")) return "purchases";
  if (pathname.startsWith("/items")) return "items";
  if (pathname.startsWith("/payroll")) return "payroll";
  return "other";
}

/** Which section a search result's own `type` naturally belongs to. */
export function sectionForResultType(type: string): SearchSection {
  switch (type) {
    case "customer":
    case "vendor":
      return "contacts";
    case "quote":
    case "invoice":
    case "credit_note":
    case "payment":
      return "sales";
    case "bill":
    case "purchase_order":
    case "expense":
      return "purchases";
    case "item":
      return "items";
    case "employee":
      return "payroll";
    default:
      return "other";
  }
}
