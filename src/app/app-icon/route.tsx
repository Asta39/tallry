import { ImageResponse } from "next/og";

// Rendered per size/pad query — not statically collapsed to one variant.
export const dynamic = "force-dynamic";

/**
 * Dynamically-rendered PWA icon — the Zeno gold monogram on a brand-teal tile.
 * ?size=192|512, ?pad=1 for the maskable (safe-zone) variant.
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const size = Number(url.searchParams.get("size")) || 512;
  const pad = url.searchParams.get("pad") === "1";
  const inset = pad ? Math.round(size * 0.12) : 0;
  const box = size - inset * 2;
  const iconUrl = `${url.origin}/images/brand/zeno-icon.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
        }}
      >
        <div
          style={{
            width: box,
            height: box,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f766e",
            borderRadius: pad ? box * 0.5 : box * 0.22,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconUrl} width={box * 0.62} height={box * 0.62} style={{ objectFit: "contain" }} alt="" />
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
