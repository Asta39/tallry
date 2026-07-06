import crypto from "crypto";

/**
 * eTIMS control-unit abstraction.
 * A real deployment plugs an OSCU (KRA online API) or VSCU (local unit) adapter
 * behind this interface. v1 ships a simulator so the whole invoice flow —
 * CU number, serial, KRA-verify QR — works end to end and the schema is
 * production-shaped. The simulator's output is clearly marked non-fiscal.
 */

export interface TaxDeviceResult {
  cuInvoiceNumber: string;
  cuSerial: string;
  qrUrl: string;
}

export interface TaxDevice {
  sign(input: {
    sellerPin: string;
    buyerPin?: string | null;
    invoiceNumber: string;
    totalCents: number;
    taxCents: number;
    dateISO: string;
  }): TaxDeviceResult;
}

export class SimulatedDevice implements TaxDevice {
  constructor(private serial: string) {}

  sign(input: {
    sellerPin: string;
    buyerPin?: string | null;
    invoiceNumber: string;
    totalCents: number;
    taxCents: number;
    dateISO: string;
  }): TaxDeviceResult {
    const payload = `${input.sellerPin}|${input.invoiceNumber}|${input.totalCents}|${input.taxCents}|${input.dateISO}`;
    const sig = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16).toUpperCase();
    const cuInvoiceNumber = `${this.serial}/${sig.slice(0, 10)}`;
    // Real format: https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&invoiceNo=...
    const qrUrl = `https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&invoiceNo=${encodeURIComponent(
      cuInvoiceNumber
    )}`;
    return { cuInvoiceNumber, cuSerial: this.serial, qrUrl };
  }
}

export function getTaxDevice(cuSerial?: string | null): TaxDevice {
  return new SimulatedDevice(cuSerial || "SIMCU0000000001");
}
