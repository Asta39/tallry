import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

import { fmtKES } from "@/lib/money";
import type { StatementLine } from "@/lib/phase-a-actions";

interface Props {
  org: { name: string; address: string | null; phone: string | null; email: string | null; logoUrl: string | null; brandColor: string; kraPin: string | null };
  contact: { name: string; address: string | null; kraPin: string | null };
  from: string;
  to: string;
  openingCents: number;
  closingCents: number;
  lines: StatementLine[];
}

const styles = StyleSheet.create({
  page: {
    padding: "36pt 48pt",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  headerLeft: {
    maxWidth: "55%",
  },
  headerRight: {
    maxWidth: "40%",
    alignItems: "flex-end",
  },
  logo: {
    height: 48,
    objectFit: "contain",
    marginBottom: 12,
  },
  orgName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  metaText: {
    color: "#4b5563",
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  metaGrid: {
    width: "100%",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    color: "#6b7280",
    width: 70,
    textAlign: "right",
  },
  metaValue: {
    color: "#111827",
    textAlign: "right",
    minWidth: 80,
  },
  billTo: {
    marginBottom: 24,
  },
  billToLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  billToName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },
  table: {
    marginTop: 16,
  },
  tableHeader: {
    flexDirection: "row",
    padding: "8pt 6pt",
    borderRadius: 4,
    color: "#ffffff",
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: "6pt",
    borderBottom: "1pt solid #f3f4f6",
  },
  th: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    color: "#374151",
  },
});

export function StatementPdf({ org, contact, from, to, openingCents, closingCents, lines }: Props) {
  const brandColor = org.brandColor || "#0f766e";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {org.logoUrl && <Image src={org.logoUrl} style={styles.logo} />}
            <Text style={styles.orgName}>{org.name}</Text>
            {org.kraPin && <Text style={styles.metaText}>PIN: {org.kraPin}</Text>}
            {org.address && <Text style={styles.metaText}>{org.address}</Text>}
            {org.phone && <Text style={styles.metaText}>{org.phone}</Text>}
            {org.email && <Text style={styles.metaText}>{org.email}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.title, { color: brandColor }]}>STATEMENT</Text>
            <View style={styles.metaGrid}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date:</Text>
                <Text style={styles.metaValue}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Period:</Text>
                <Text style={styles.metaValue}>{from} to {to}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Amount Due:</Text>
                <Text style={[styles.metaValue, { fontWeight: "bold" }]}>{fmtKES(closingCents)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>To:</Text>
          <Text style={styles.billToName}>{contact.name}</Text>
          {contact.address && <Text style={styles.metaText}>{contact.address}</Text>}
          {contact.kraPin && <Text style={styles.metaText}>PIN: {contact.kraPin}</Text>}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: brandColor }]}>
            <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
            <Text style={[styles.th, { flex: 2 }]}>Details</Text>
            <Text style={[styles.th, { flex: 4 }]}>Reference</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Charges</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Payments</Text>
            <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Balance</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.td, { flex: 1.5 }]}></Text>
            <Text style={[styles.td, { flex: 6, fontWeight: "bold" }]}>Opening Balance</Text>
            <Text style={[styles.td, { flex: 2, textAlign: "right" }]}></Text>
            <Text style={[styles.td, { flex: 2, textAlign: "right" }]}></Text>
            <Text style={[styles.td, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>{fmtKES(openingCents)}</Text>
          </View>

          {lines.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 1.5 }]}>{l.date}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{l.description}</Text>
              <Text style={[styles.td, { flex: 4 }]}>{l.ref}</Text>
              <Text style={[styles.td, { flex: 2, textAlign: "right" }]}>{l.debitCents ? fmtKES(l.debitCents) : ""}</Text>
              <Text style={[styles.td, { flex: 2, textAlign: "right" }]}>{l.creditCents ? fmtKES(l.creditCents) : ""}</Text>
              <Text style={[styles.td, { flex: 2, textAlign: "right" }]}>{fmtKES(l.balanceCents)}</Text>
            </View>
          ))}
          
          <View style={[styles.tableRow, { borderBottom: "none", borderTop: "1pt solid #e5e7eb", paddingTop: 8 }]}>
            <Text style={[styles.td, { flex: 7.5 }]}></Text>
            <Text style={[styles.td, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>Closing Balance</Text>
            <Text style={[styles.td, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>{fmtKES(closingCents)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
