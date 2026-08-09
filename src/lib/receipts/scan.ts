"use server";

import crypto from "crypto";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "receipts";

export type ScannedReceiptFields = {
  vendorName: string | null;
  totalCents: number | null;
  date: string | null; // YYYY-MM-DD
  vatCents: number | null;
  description: string | null;
};

const PROMPT = `You are reading a photo of a physical receipt or vendor bill for a Kenyan small business expense claim. Extract exactly these fields as JSON:
- vendorName: the shop/supplier name printed on the receipt, or null if unreadable
- totalCents: the final total amount paid, as an integer number of cents (e.g. KSh 450.00 -> 45000), or null if unreadable
- date: the transaction date in YYYY-MM-DD format, or null if unreadable (assume the current year if only day/month shown)
- vatCents: the VAT/tax amount shown, as an integer number of cents, or null if not shown separately
- description: a short (under 8 words) plain description of what was purchased, e.g. "Fuel", "Stationery", "Hardware materials"

Respond with ONLY the JSON object, no markdown, no explanation. If the image isn't a legible receipt at all, return all fields as null.`;

async function callGemini(base64Image: string, mimeType: string): Promise<ScannedReceiptFields> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Receipt scanning isn't configured — GEMINI_API_KEY is missing.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Receipt scan failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Receipt scan returned no result — try a clearer photo.");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not read the receipt — try a clearer, well-lit photo.");
  }

  return {
    vendorName: typeof parsed.vendorName === "string" ? parsed.vendorName.trim() || null : null,
    totalCents: Number.isFinite(parsed.totalCents) ? Math.round(parsed.totalCents) : null,
    date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
    vatCents: Number.isFinite(parsed.vatCents) ? Math.round(parsed.vatCents) : null,
    description: typeof parsed.description === "string" ? parsed.description.trim() || null : null,
  };
}

/** Uploads the photo to private storage and asks Gemini to extract the
 *  claim-relevant fields — best-effort prefill only, the claimant still sees
 *  and can correct every field before submitting. Never trusted as-is: the
 *  claim amount/category/description the accountant sees are whatever ended
 *  up in the form, not whatever the model returned. */
export async function scanReceiptAction(
  base64Image: string,
  mimeType: string
): Promise<{ receiptPath: string; fields: ScannedReceiptFields } | { error: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("expense_claims");
      const orgId = currentOrgId();

      if (!mimeType.startsWith("image/")) throw new Error("Only image files are supported");
      const bytes = Buffer.from(base64Image, "base64");
      if (bytes.length > 8 * 1024 * 1024) throw new Error("Photo is too large (max 8MB)");

      const supabase = createAdminClient();
      await supabase.storage.createBucket(BUCKET, { public: false }).catch((e) => {
        if (!/already exists/i.test(e?.message || "")) throw e;
      });

      const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      let fields: ScannedReceiptFields;
      try {
        fields = await callGemini(base64Image, mimeType);
      } catch (e: any) {
        // The photo is safely uploaded either way — a scan failure just means
        // an empty prefill, not a lost receipt.
        return { receiptPath: path, fields: { vendorName: null, totalCents: null, date: null, vatCents: null, description: null } };
      }

      return { receiptPath: path, fields };
    });
  } catch (err: any) {
    return { error: err?.message || "Could not process the receipt" };
  }
}

/** Signed, time-limited link to view a previously-uploaded receipt photo —
 *  the bucket is private, so this is the only way to fetch it. */
export async function getReceiptViewUrlAction(receiptPath: string): Promise<string | { error: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("expense_claims");
      const orgId = currentOrgId();
      if (!receiptPath.startsWith(`${orgId}/`)) throw new Error("Not found");
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(receiptPath, 300);
      if (error || !data) throw error || new Error("Could not create a link to this receipt");
      return data.signedUrl;
    });
  } catch (err: any) {
    return { error: err?.message || "Could not open this receipt" };
  }
}
