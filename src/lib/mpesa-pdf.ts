/**
 * M-Pesa PDF statement parser (server-only).
 *
 * Safaricom emails a password-protected PDF (password = the account holder's
 * National ID number). The "Detailed Statement" table has columns:
 *   Receipt No. | Completion Time | Details | Transaction Status | Paid In | Withdrawn | Balance
 *
 * We extract text with pdfjs-dist (which decrypts with the supplied password),
 * then reconstruct rows from the positioned text items. Layout varies slightly
 * between statement versions, so parsing is tolerant: we anchor on the receipt
 * code + timestamp pattern and read the money columns by x-position.
 */

// pdfjs legacy build works in Node without a DOM.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsLib;
}

export interface MpesaTxn {
  receipt: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  details: string;
  amountCents: number; // + paid in, − withdrawn
  balanceCents: number;
}

const RECEIPT_RE = /^[A-Z0-9]{10}$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})$/;

function toCents(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  const neg = cleaned.startsWith("-") || cleaned.startsWith("(");
  const n = Number(cleaned.replace(/[()\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

/**
 * Extract raw text lines (in reading order) from every page.
 * pdfjs gives text items with transform matrices; we group by y then sort by x.
 */
async function extractLines(data: Uint8Array, password: string): Promise<string[][]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data, password, useSystemFonts: true, isEvalSupported: false }).promise;
  const lines: string[][] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group items into rows by rounded y-coordinate
    const rows = new Map<number, { x: number; s: string }[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) {
      const str = (item.str ?? "").trim();
      if (!str) continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5]);
      const bucket = rows.get(y) ?? [];
      bucket.push({ x, s: str });
      rows.set(y, bucket);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a); // top to bottom
    for (const y of ys) {
      const cells = rows.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.s);
      lines.push(cells);
    }
  }
  await doc.destroy();
  return lines;
}

export class MpesaPasswordError extends Error {}

/**
 * Parse an M-Pesa statement PDF into transactions.
 * Throws MpesaPasswordError if the password is wrong/missing.
 */
export async function parseMpesaPdf(data: Uint8Array, password: string): Promise<MpesaTxn[]> {
  let lines: string[][];
  try {
    lines = await extractLines(data, password);
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (e as any)?.name ?? "";
    if (name === "PasswordException" || /password/i.test(String((e as Error).message))) {
      throw new MpesaPasswordError("Wrong PDF password. Use the National ID number the statement was issued to.");
    }
    throw e;
  }

  const txns: MpesaTxn[] = [];
  // Flatten each row to a single string, then regex the structured parts.
  // A data row looks like: RECEIPT  YYYY-MM-DD HH:MM:SS  <details…>  <status>  <paidIn>  <withdrawn>  <balance>
  for (const cells of lines) {
    if (cells.length < 4) continue;
    const receipt = cells[0];
    if (!RECEIPT_RE.test(receipt)) continue;

    // Find the datetime cell (may be one cell "YYYY-MM-DD HH:MM:SS" or two cells)
    let dtIndex = -1;
    let dateStr = "", timeStr = "";
    for (let i = 1; i < cells.length; i++) {
      const one = DATETIME_RE.exec(cells[i]);
      if (one) { dtIndex = i; dateStr = `${one[1]}-${one[2]}-${one[3]}`; timeStr = one[4]; break; }
      const two = /^\d{4}-\d{2}-\d{2}$/.test(cells[i]) && /^\d{2}:\d{2}:\d{2}$/.test(cells[i + 1] ?? "");
      if (two) { dtIndex = i; dateStr = cells[i]; timeStr = cells[i + 1]; break; }
    }
    if (dtIndex < 0) continue;

    // Money cells: last 3 numeric-looking cells are Paid In, Withdrawn, Balance
    const moneyIdx: number[] = [];
    for (let i = cells.length - 1; i >= 0 && moneyIdx.length < 3; i--) {
      if (/^-?[\d,]+\.\d{2}$/.test(cells[i].replace(/[()]/g, ""))) moneyIdx.unshift(i);
    }
    if (moneyIdx.length < 2) continue;

    const balanceCents = toCents(cells[moneyIdx[moneyIdx.length - 1]]);
    // Paid In / Withdrawn: whichever of the two before balance is non-zero.
    const a = moneyIdx.length >= 3 ? toCents(cells[moneyIdx[0]]) : 0;
    const b = moneyIdx.length >= 3 ? toCents(cells[moneyIdx[1]]) : toCents(cells[moneyIdx[0]]);
    // Withdrawn is stored negative in statements; Paid In positive.
    let amountCents: number;
    if (moneyIdx.length >= 3) {
      amountCents = a !== 0 ? Math.abs(a) : -Math.abs(b);
    } else {
      amountCents = b; // single amount column, sign as-is
    }

    const detailStart = timeStr && cells[dtIndex + 1] === timeStr ? dtIndex + 2 : dtIndex + 1;
    const details = cells
      .slice(detailStart, moneyIdx[0])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || "M-Pesa transaction";

    txns.push({ receipt, date: dateStr, time: timeStr, details, amountCents, balanceCents });
  }

  return txns;
}
