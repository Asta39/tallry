import {
  Body,
  Container,
  Heading,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import { EmailHeader, EmailFooter } from "./Brand";

interface InvoiceReminderProps {
  customerName: string;
  orgName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  daysOverdue: number;
}

export const InvoiceReminder = ({
  customerName,
  orgName,
  logoUrl,
  brandColor,
  invoiceNumber,
  amountDue,
  dueDate,
  daysOverdue,
}: InvoiceReminderProps) => {
  const color = brandColor || "#0f172a";
  return (
    <Html>
      <Head />
      <Preview>Reminder: Invoice {invoiceNumber} — {amountDue} due</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader orgName={orgName} logoUrl={logoUrl} brandColor={brandColor} />

          <Heading style={h1}>Payment Reminder</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            A friendly reminder: Invoice <strong>{invoiceNumber}</strong> for{" "}
            <strong>{amountDue}</strong> was due on {dueDate} and is now {daysOverdue} day
            {daysOverdue === 1 ? "" : "s"} overdue.
          </Text>
          <Section style={box}>
            <Text style={boxLine}><span style={label}>Invoice:</span> {invoiceNumber}</Text>
            <Text style={boxLine}>
              <span style={label}>Amount due:</span> <span style={{ color, fontWeight: 700 }}>{amountDue}</span>
            </Text>
            <Text style={boxLine}><span style={label}>Due date:</span> {dueDate}</Text>
          </Section>
          <Text style={text}>
            If you have already paid, please disregard this message — payments can take a
            moment to reflect.
          </Text>
          <EmailFooter orgName={orgName} />
        </Container>
      </Body>
    </Html>
  );
};

export default InvoiceReminder;

const main = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  marginTop: "32px",
  borderRadius: "16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  maxWidth: "500px",
};
const h1 = { fontSize: "18px", fontWeight: 700 as const, margin: "0 0 16px", color: "#111827" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#374151" };
const box = {
  backgroundColor: "#f9fafb",
  borderRadius: "10px",
  padding: "14px 18px",
  margin: "16px 0",
};
const boxLine = { fontSize: "13px", margin: "4px 0", color: "#333" };
const label = { color: "#6b7280" };
