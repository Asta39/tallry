import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";

export interface PdfOrg {
  name: string;
  kraPin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  brandColor: string;
  documentFooterText?: string | null;
}

export interface PdfContact {
  displayName: string;
  address?: string | null;
  city?: string | null;
  kraPin?: string | null;
}

export interface PdfStatementLine {
  id: string;
  date: string;
  type: "invoice" | "payment";
  description: string;
  amountCents: number;
  balance: number;
}

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { padding: 42, fontSize: 9.5, fontFamily: "Helvetica", color: "#1d1d1f" },
    headerRow: { flexDirection: "row", justifyContent: "space-between" },
    logo: { maxWidth: 130, maxHeight: 56, objectFit: "contain", marginBottom: 8 },
    orgName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
    muted: { color: "#6e6e73" },
    docTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", color: brand, textAlign: "right" },
    metaRight: { textAlign: "right", marginTop: 4, lineHeight: 1.5 },
    billTo: { marginTop: 26 },
    sectionLabel: {
      fontSize: 7.5,
      color: "#6e6e73",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    bold: { fontFamily: "Helvetica-Bold" },
    table: { marginTop: 22 },
    thRow: {
      flexDirection: "row",
      backgroundColor: brand,
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginBottom: 2,
      borderRadius: 4,
    },
    th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.6 },
    tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e8e8ed", paddingVertical: 5.5, paddingHorizontal: 4 },
    cDate: { width: "15%", paddingRight: 6 },
    cDetails: { width: "45%", paddingRight: 6 },
    cAmount: { width: "20%", textAlign: "right" },
    cBalance: { width: "20%", textAlign: "right" },
    docFooterText: {
      marginTop: 24,
      paddingTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: "#e8e8ed",
      fontSize: 8,
      color: "#86868b",
      lineHeight: 1.4,
    },
  });
}

export function StatementPdf({
  org,
  contact,
  lines,
}: {
  org: PdfOrg;
  contact: PdfContact;
  lines: PdfStatementLine[];
}) {
  const brand = org.brandColor || "#0f766e";
  const s = makeStyles(brand);
  const totalDue = lines.length > 0 ? lines[lines.length - 1].balance : 0;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {org.logoUrl ? <Image src={org.logoUrl} style={s.logo} /> : null}
            <Text style={s.orgName}>{org.name}</Text>
            {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
            {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
            {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
            {org.kraPin ? <Text style={s.muted}>PIN: {org.kraPin}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>STATEMENT OF ACCOUNT</Text>
            <Text style={s.metaRight}>
              <Text style={s.muted}>Date: </Text>
              <Text style={s.bold}>{new Date().toISOString().slice(0, 10)}</Text>
            </Text>
            <Text style={s.metaRight}>
              <Text style={s.muted}>Amount Due: </Text>
              <Text style={s.bold}>{fmtKES(totalDue)}</Text>
            </Text>
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.sectionLabel}>To</Text>
          <Text style={s.bold}>{contact.displayName}</Text>
          {contact.address ? <Text style={s.muted}>{contact.address}</Text> : null}
          {contact.city ? <Text style={s.muted}>{contact.city}</Text> : null}
          {contact.kraPin ? (
            <Text>
              PIN: <Text style={s.bold}>{contact.kraPin}</Text>
            </Text>
          ) : null}
        </View>

        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.th, s.cDate]}>Date</Text>
            <Text style={[s.th, s.cDetails]}>Details</Text>
            <Text style={[s.th, s.cAmount]}>Amount</Text>
            <Text style={[s.th, s.cBalance]}>Balance</Text>
          </View>
          {lines.map((l) => (
            <View style={s.tr} key={l.id} wrap={false}>
              <Text style={s.cDate}>{l.date}</Text>
              <Text style={s.cDetails}>{l.description}</Text>
              <Text style={[s.cAmount, l.type === "payment" ? { color: "#16a34a" } : {}]}>
                {fmtKES(l.amountCents)}
              </Text>
              <Text style={s.cBalance}>{fmtKES(l.balance)}</Text>
            </View>
          ))}
        </View>

        {org.documentFooterText && (
          <Text style={s.docFooterText}>{org.documentFooterText}</Text>
        )}
      </Page>
    </Document>
  );
}
