import { Column, Hr, Img, Row, Section, Text } from "@react-email/components";
import React from "react";

export interface BrandProps {
  orgName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}

/**
 * Letterhead the org's name (and logo, if set) at the top of every email —
 * every send previously opened straight into body copy with no indication of
 * which business it was from beyond the sender address.
 */
export function EmailHeader({ orgName, logoUrl, brandColor }: BrandProps) {
  const color = brandColor || "#0f172a";
  return (
    <Section style={{ marginBottom: "28px" }}>
      <Row>
        <Column>
          {logoUrl ? (
            <Img src={logoUrl} alt={orgName} width="40" height="40" style={logoImg} />
          ) : (
            <div style={{ ...logoFallback, backgroundColor: color }}>
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
        </Column>
        <Column>
          <Text style={{ ...orgNameText, color }}>{orgName}</Text>
        </Column>
      </Row>
      <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0 0" }} />
    </Section>
  );
}

export function EmailFooter({ orgName }: { orgName: string }) {
  return (
    <>
      <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 16px" }} />
      <Text style={footerText}>
        Sent by <strong>{orgName}</strong> via Zeno · Reply to this email with any questions.
      </Text>
    </>
  );
}

const logoImg: React.CSSProperties = {
  borderRadius: "8px",
  objectFit: "contain",
  display: "block",
};

const logoFallback: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 700,
  textAlign: "center",
  lineHeight: "40px",
};

const orgNameText: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  margin: "0 0 0 12px",
  lineHeight: "40px",
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  lineHeight: "18px",
};
