import QRCode from "qrcode";

/** PNG data URL of a QR encoding the given URL — for PDFs and print views. */
export async function qrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
