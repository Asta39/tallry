/** Section prefixes that group routes but have no page of their own. */
const NO_PAGE = new Set(["/sales", "/payroll", "/purchases", "/accounting"]);

/** The nearest route above `path` that actually renders a page — where the
 *  back button goes when there's no in-app history to return to. */
export function parentRoute(path: string): string {
  let p = path.replace(/\/+$/, "");
  do {
    p = p.slice(0, p.lastIndexOf("/"));
  } while (p && NO_PAGE.has(p));
  return p || "/home";
}
