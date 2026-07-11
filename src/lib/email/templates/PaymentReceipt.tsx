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

interface PaymentReceiptProps {
  customerName: string;
  amount: string;
  invoiceNumber: string;
  paymentMethod: string;
  receiptNumber: string;
  date: string;
}

export const PaymentReceipt = ({
  customerName,
  amount,
  invoiceNumber,
  paymentMethod,
  receiptNumber,
  date,
}: PaymentReceiptProps) => {
  return (
    <Html>
      <Head />
      <Preview>Receipt for your payment of {amount}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Received</Heading>
          
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            We have successfully received your payment of <strong>{amount}</strong> for Invoice <strong>{invoiceNumber}</strong>.
          </Text>

          <Section style={receiptSection}>
            <Text style={receiptItem}>
              <span style={receiptLabel}>Amount Paid:</span>
              <span style={receiptValue}>{amount}</span>
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
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Thank you for your business!<br />
            If you have any questions, please reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  marginBottom: "64px",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  maxWidth: "600px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
};

const text = {
  color: "#333",
  fontSize: "14px",
  lineHeight: "24px",
};

const receiptSection = {
  backgroundColor: "#f9fafb",
  padding: "24px",
  borderRadius: "8px",
  marginTop: "24px",
  marginBottom: "24px",
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
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

export default PaymentReceipt;
