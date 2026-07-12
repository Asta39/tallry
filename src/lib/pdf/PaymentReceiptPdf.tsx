import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";
import type { PdfOrg, PdfContact } from "./DocumentPdf";

export interface PdfPayment {
  id: number;
  date: string;
  reference: string | null;
  method: string | null;
  amountCents: number;
  invoiceNumber: string;
}

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { paddingTop: 42, paddingLeft: 42, paddingRight: 42, paddingBottom: 140, fontSize: 9.5, fontFamily: "Helvetica", color: "#1d1d1f" },
    headerRow: { flexDirection: "row", justifyContent: "space-between" },
    logo: { maxWidth: 220, maxHeight: 90, objectFit: "contain", objectPosition: "left", marginBottom: 12 },
    orgName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
    muted: { color: "#6e6e73" },
    docTitle: { fontSize: 24, fontFamily: "Helvetica", fontWeight: "light", color: brand, textAlign: "right", textTransform: "uppercase" },
    metaRight: { textAlign: "right", marginTop: 4, lineHeight: 1.5 },
    billTo: { marginTop: 36 },
    sectionLabel: {
      fontSize: 7.5,
      color: "#6e6e73",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    bold: { fontFamily: "Helvetica-Bold" },
    table: { marginTop: 36 },
    thRow: {
      flexDirection: "row",
      borderBottomWidth: 1.5,
      borderBottomColor: "#1d1d1f",
      paddingVertical: 6,
      paddingHorizontal: 2,
      marginBottom: 2,
    },
    th: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#6e6e73" },
    tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e8e8ed", paddingVertical: 8, paddingHorizontal: 2 },
    cDate: { width: "25%", paddingRight: 6 },
    cRef: { width: "25%", paddingRight: 6 },
    cMode: { width: "20%", paddingRight: 6, textTransform: "capitalize" },
    cAmount: { width: "30%", textAlign: "right" },
    footerSection: {
      marginTop: 48,
      paddingTop: 16,
      borderTopWidth: 0.5,
      borderTopColor: "#e8e8ed",
      fontSize: 8.5,
      color: "#86868b",
      lineHeight: 1.4,
    },
  });
}

export function PaymentReceiptPdf({
  org,
  contact,
  payment,
  qrDataUrl,
  receiptUrl,
}: {
  org: PdfOrg;
  contact: PdfContact;
  payment: PdfPayment;
  qrDataUrl?: string;   // PNG data URL of the public receipt link
  receiptUrl?: string;
}) {
  const brand = org.brandColor || "#0f766e";
  const s = makeStyles(brand);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {org.logoUrl ? <Image src={org.logoUrl} style={s.logo} /> : null}
            <Text style={s.orgName}>{org.name}</Text>
            {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
            {org.kraPin ? <Text style={s.muted}>PIN: {org.kraPin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>Receipt</Text>
            <Text style={s.metaRight}>
              <Text style={s.muted}>Receipt #: PAY-{payment.id.toString().padStart(4, "0")}</Text>
            </Text>
            <Text style={s.metaRight}>
              <Text style={s.muted}>Date: {payment.date}</Text>
            </Text>
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.sectionLabel}>Received From</Text>
          <Text style={[s.bold, { fontSize: 10.5 }]}>{contact.displayName}</Text>
        </View>

        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.th, s.cDate]}>Payment Date</Text>
            <Text style={[s.th, s.cRef]}>Reference Number</Text>
            <Text style={[s.th, s.cMode]}>Payment Mode</Text>
            <Text style={[s.th, s.cAmount]}>Amount Received</Text>
          </View>
          <View style={s.tr}>
            <Text style={s.cDate}>{payment.date}</Text>
            <Text style={s.cRef}>{payment.reference || "—"}</Text>
            <Text style={s.cMode}>{payment.method || "—"}</Text>
            <Text style={[s.cAmount, s.bold]}>{fmtKES(payment.amountCents)}</Text>
          </View>
        </View>

        {qrDataUrl ? (
          <View style={{ marginTop: 36, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image src={qrDataUrl} style={{ width: 72, height: 72 }} />
            <View style={{ marginLeft: 12 }}>
              <Text style={s.sectionLabel}>Digital copy</Text>
              <Text style={s.muted}>Scan to view or download this receipt anytime.</Text>
              {receiptUrl ? <Text style={s.muted}>{receiptUrl}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={s.footerSection}>
          <Text style={{ marginBottom: 8 }}>This is a payment receipt for Invoice #{payment.invoiceNumber}.</Text>
          {org.documentFooterText && <Text>{org.documentFooterText}</Text>}
        </View>
      </Page>
    </Document>
  );
}
