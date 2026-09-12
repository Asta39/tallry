import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface PurchaseRequestNoticeProps {
  name: string;
  phone: string;
  email: string;
  packageLabel: string;
  amount: string;
  createdAt: string;
}

/** Platform-level notice (not org-branded) — lands in the super-admin
 *  inbox when a prospect submits a one-time-purchase request from the
 *  public pricing section, before any org exists. */
export const PurchaseRequestNotice = ({
  name,
  phone,
  email,
  packageLabel,
  amount,
  createdAt,
}: PurchaseRequestNoticeProps) => (
  <Html>
    <Head />
    <Preview>New one-time purchase request from {name} — {amount}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>New purchase request</Heading>
        <Text style={text}>
          Someone submitted a one-time-purchase request from the public pricing page. Follow up for payment, then activate their org as usual.
        </Text>
        <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />
        <Section>
          <Row label="Name" value={name} />
          <Row label="Phone" value={phone} />
          <Row label="Email" value={email} />
          <Row label="Package" value={packageLabel} />
          <Row label="Total" value={amount} />
          <Row label="Submitted" value={createdAt} />
        </Section>
      </Container>
    </Body>
  </Html>
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={rowText}>
      <strong>{label}:</strong> {value}
    </Text>
  );
}

const main: React.CSSProperties = { backgroundColor: "#f5f5f7", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" };
const container: React.CSSProperties = { backgroundColor: "#ffffff", margin: "40px auto", padding: "32px", borderRadius: "12px", maxWidth: "480px" };
const heading: React.CSSProperties = { fontSize: "20px", fontWeight: 700, margin: "0 0 12px", color: "#0f172a" };
const text: React.CSSProperties = { fontSize: "14px", lineHeight: "22px", color: "#374151", margin: "0 0 8px" };
const rowText: React.CSSProperties = { fontSize: "14px", lineHeight: "24px", color: "#0f172a", margin: "0" };

export default PurchaseRequestNotice;
