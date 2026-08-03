# Debug Session: invoice-issue-500
- **Status**: [OPEN]
- **Issue**: Issuing an invoice after converting it from a quote still throws a 500 in production, surfacing as a minified React error and a failed resource request.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-invoice-issue-500.ndjson

## Reproduction Steps
1. Open a quote.
2. Convert the quote into an invoice.
3. Open the converted invoice.
4. Click `Issue`.
5. Observe the 500 and the minified React error in the browser console.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Issuing reaches `postInvoice`, but a converted line still carries invalid warehouse or cost-center state that breaks posting. | High | Low | Pending |
| B | A referenced item/contact/account on the converted invoice is missing or cross-org, so issue fails during DB lookups or posting. | Medium | Low | Pending |
| C | The invoice posts, but the follow-up render crashes on converted-invoice data, causing the visible 500 after issue. | Medium | Medium | Pending |
| D | The issue action throws a domain error, but the client path isn't surfacing it cleanly and falls through to a generic Server Components failure. | High | Low | Pending |
| E | A FIFO/default-warehouse stock path fails only when issuing converted invoices with tracked items. | Medium | Medium | Pending |

## Log Evidence
- Instrumentation added to `src/components/DocActions.tsx`, `src/lib/actions.ts`, and `src/lib/posting.ts`.
- `pre-fix` reproduction captured only client-side logs from `DocActions`; no server-side logs from `issueDocument`, `withOrg`, or `postInvoice` were emitted.
- This narrows the failure to a point before `_issueDocument()` begins, likely at server-action entry or org/write-gate resolution.
- Structured action error handling exposed the real production failure: `No default warehouse configured for this organization`.
- Vercel stack points into inventory FIFO warehouse resolution during invoice posting.

## Verification Conclusion
- `E`: Confirmed. Posting a converted invoice can reach FIFO consumption for a tracked item line with no explicit `warehouseId`; when the org has one warehouse but none marked `isDefault`, inventory posting throws.
- `D`: Confirmed earlier as a UX issue too; the action was surfacing as a masked 500 because `issueDocument()` did not return structured errors.
- `A`, `B`, `C`: Rejected for this reproduction based on the surfaced production error.
- Fix in progress: fall back to the sole active warehouse when no default is marked, and make the first created warehouse default for future orgs.
