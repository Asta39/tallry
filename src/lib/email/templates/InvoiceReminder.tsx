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

interface InvoiceReminderProps {
  customerName: string;
  orgName: string;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  daysOverdue: number;
}

export const InvoiceReminder = ({
  customerName,
  orgName,
  invoiceNumber,
  amountDue,
  dueDate,
  daysOverdue,
}: InvoiceReminderProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reminder: Invoice {invoiceNumber} — {amountDue} due</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Reminder</Heading>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            A friendly reminder from <strong>{orgName}</strong>: Invoice{" "}
            <strong>{invoiceNumber}</strong> for <strong>{amountDue}</strong> was due on{" "}
            {dueDate} and is now {daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue.
          </Text>
          <Section style={box}>
            <Text style={boxLine}><span style={label}>Invoice:</span> {invoiceNumber}</Text>
            <Text style={boxLine}><span style={label}>Amount due:</span> {amountDue}</Text>
            <Text style={boxLine}><span style={label}>Due date:</span> {dueDate}</Text>
          </Section>
          <Text style={text}>
            If you have already paid, please disregard this message — payments can take a
            moment to reflect.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Sent on behalf of {orgName}. Reply to this email with any questions.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvoiceReminder;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  borderRadius: "8px",
  maxWidth: "480px",
};
const h1 = { fontSize: "20px", fontWeight: 700 as const, margin: "0 0 16px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#333" };
const box = {
  backgroundColor: "#f6f9fc",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "16px 0",
};
const boxLine = { fontSize: "13px", margin: "4px 0", color: "#333" };
const label = { color: "#6b7280" };
const hr = { borderColor: "#e5e7eb", margin: "24px 0 12px" };
const footer = { fontSize: "12px", color: "#9ca3af" };
