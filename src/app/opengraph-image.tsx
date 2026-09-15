import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview card for shares on WhatsApp/X/LinkedIn — same gold-on-teal
 *  identity as the app icon and hero, so a shared link is recognizable at a
 *  glance before anyone even clicks through. Logo embedded as a data URI
 *  (read straight from disk) rather than an absolute URL, so this renders
 *  correctly regardless of deployment origin. */
export default function Image() {
  const logoPath = path.join(process.cwd(), "public/images/brand/zeno-icon.png");
  const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b332f",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={140} height={140} alt="" />
        <div style={{ marginTop: 28, fontSize: 72, fontWeight: 700, color: "#fbfbfa", letterSpacing: "0.02em" }}>
          ZENO
        </div>
        <div style={{ marginTop: 14, fontSize: 30, fontWeight: 400, color: "rgba(251,251,250,0.75)" }}>
          Accounting, CRM &amp; Payroll for Kenyan Businesses
        </div>
      </div>
    ),
    { ...size }
  );
}
