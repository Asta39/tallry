/**
 * Kenyan MSISDN normalization, shared by every gateway.
 *
 * Users type 0712 345 678, +254712345678, 712345678 — providers accept none of
 * those interchangeably. Daraja wants bare 2547XXXXXXXX; Kopo Kopo accepts
 * either that or the E.164 +254 form.
 *
 * Throws on anything that isn't a valid Safaricom/Airtel-range Kenyan mobile,
 * so a malformed number fails here with a readable message rather than as an
 * opaque provider rejection.
 */
export function normalizeKenyanPhone(input: string): string {
  const digits = (input || "").replace(/[^\d]/g, "");
  let msisdn = digits;
  if (digits.startsWith("0")) msisdn = "254" + digits.slice(1);
  else if (digits.startsWith("7") || digits.startsWith("1")) msisdn = "254" + digits;
  if (!/^254(7|1)\d{8}$/.test(msisdn)) {
    throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678");
  }
  return msisdn;
}

/** Same, in E.164 (+254…). */
export function toE164(input: string): string {
  return `+${normalizeKenyanPhone(input)}`;
}
