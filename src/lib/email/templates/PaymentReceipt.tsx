import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import { EmailHeader, EmailFooter } from "./Brand";

interface PaymentReceiptProps {
  orgName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  customerName: string;
  amount: string;
  invoiceNumber: string;
  paymentMethod: string;
  receiptNumber: string;
  reference?: string | null;
  date: string;
  receiptUrl?: string;
}

export const PaymentReceipt = ({
  orgName,
  logoUrl,
  brandColor,
  customerName,
  amount,
  invoiceNumber,
  paymentMethod,
  receiptNumber,
  reference,
  date,
  receiptUrl,
}: PaymentReceiptProps) => {
  const color = brandColor || "#0f172a";
  return (
    <Html>
      <Head />
      <Preview>Receipt for your payment of {amount}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader orgName={orgName} logoUrl={logoUrl} brandColor={brandColor} />

          <Section style={{ textAlign: "center" as const, margin: "0 0 24px" }}>
            <div style={{ ...checkCircle, backgroundColor: color }}>✓</div>
            <Heading style={h1}>Payment Received</Heading>
          </Section>

          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            We have successfully received your payment of <strong>{amount}</strong> for Invoice <strong>{invoiceNumber}</strong>.
          </Text>

          <Section style={receiptSection}>
            <Text style={receiptItem}>
              <span style={receiptLabel}>Amount Paid:</span>
              <span style={{ ...receiptValue, color }}>{amount}</span>
            </Text>
            <Text style={receiptItem}>
              <span style={receiptLabel}>Date:</span>
              <span style={receiptValue}>{date}</span>
            </Text>
            <Text style={receiptItem}>
              <span style={receiptLabel}>Method:</span>
              <span style={receiptValue}>{paymentMethod}</span>
            </Text>
            <Text style={receiptItem}>
              <span style={receiptLabel}>Receipt #:</span>
              <span style={receiptValue}>{receiptNumber}</span>
            </Text>
            {reference && (
              <Text style={receiptItem}>
                <span style={receiptLabel}>Reference:</span>
                <span style={receiptValue}>{reference}</span>
              </Text>
            )}
          </Section>

          {receiptUrl && (
            <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
              <Button
                href={receiptUrl}
                style={{
                  backgroundColor: color,
                  color: "#ffffff",
                  padding: "12px 28px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View / Download PDF Receipt
              </Button>
            </Section>
          )}

          <Text style={text}>Thank you for your business!</Text>
          <EmailFooter orgName={orgName} />
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "36px 32px",
  marginTop: "32px",
  marginBottom: "64px",
  borderRadius: "16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  maxWidth: "560px",
};

const checkCircle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "48px",
  textAlign: "center",
  margin: "0 auto 12px",
};

const h1 = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "700",
  lineHeight: "28px",
  margin: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "24px",
};

const receiptSection = {
  backgroundColor: "#f9fafb",
  padding: "20px 24px",
  borderRadius: "12px",
  marginTop: "20px",
  marginBottom: "8px",
};

const receiptItem = {
  margin: "0 0 12px",
  fontSize: "14px",
  color: "#333",
  display: "flex",
  justifyContent: "space-between",
};

const receiptLabel = {
  color: "#6b7280",
  fontWeight: "500",
};

const receiptValue = {
  fontWeight: "600",
  color: "#111827",
};

export default PaymentReceipt;
