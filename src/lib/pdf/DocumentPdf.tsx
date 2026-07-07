/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";
import { TAX_CLASSES, type TaxClass } from "@/lib/tax";

/**
 * Branded PDF for invoices, quotes and credit notes.
 * Branding comes from the org record: logoUrl + brandColor.
 * Layout follows the KRA eTIMS tax-invoice requirements (PINs, per-class
 * VAT breakdown, CU number, verification QR).
 */

export interface PdfOrg {
  name: string;
  kraPin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  brandColor: string;
  customDocumentColumnName?: string | null;
  documentFooterText?: string | null;
}

export interface PdfLine {
  description: string;
  qty: number;
  unitPriceCents: number;
  taxClass: string;
  taxRateBp: number;
  netCents: number;
  taxCents: number;
  grossCents: number;
  customColumnValue?: string | null;
}

export interface PdfDoc {
  type: string;
  number: string;
  date: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  cuInvoiceNumber?: string | null;
  cuSerial?: string | null;
}

export interface PdfContact {
  displayName: string;
  address?: string | null;
  city?: string | null;
  kraPin?: string | null;
}

const titles: Record<string, string> = {
  invoice: "TAX INVOICE",
  quote: "QUOTATION",
  credit_note: "CREDIT NOTE",
};

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { paddingTop: 42, paddingLeft: 42, paddingRight: 42, paddingBottom: 140, fontSize: 9.5, fontFamily: "Helvetica", color: "#1d1d1f" },
    headerRow: { flexDirection: "row", justifyContent: "space-between" },
    logo: { maxWidth: 220, maxHeight: 90, objectFit: "contain", objectPosition: "left", marginBottom: 12 },
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
    cDesc: { width: "40%", paddingRight: 6 },
    cDescShrunk: { width: "25%", paddingRight: 6 },
    cCustom: { width: "15%", paddingRight: 6 },
    cQty: { width: "10%", textAlign: "right" },
    cPrice: { width: "17%", textAlign: "right" },
    cVat: { width: "13%", textAlign: "center" },
    cAmount: { width: "20%", textAlign: "right" },
    bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    totals: { width: 200 },
    totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
    grandTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1.4,
      borderTopColor: brand,
      marginTop: 4,
      paddingTop: 5,
    },
    grandText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: brand },
    docFooterText: {
      marginTop: 24,
      paddingTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: "#e8e8ed",
      fontSize: 8,
      color: "#86868b",
      lineHeight: 1.4,
    },
    footer: {
      position: "absolute",
      bottom: 36,
      left: 42,
      right: 42,
      borderTopWidth: 0.5,
      borderTopColor: "#d2d2d7",
      paddingTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    demoTag: { color: "#b45309", fontFamily: "Helvetica-Bold", fontSize: 7.5, marginTop: 3 },
    qr: { width: 76, height: 76 },
  });
}

export function DocumentPdf({
  org,
  doc,
  contact,
  lines,
  qrDataUrl,
}: {
  org: PdfOrg;
  doc: PdfDoc;
  contact?: PdfContact | null;
  lines: PdfLine[];
  qrDataUrl?: string | null;
}) {
  const s = makeStyles(org.brandColor || "#0f766e");
  const byClass = new Map<string, { net: number; tax: number }>();
  for (const l of lines) {
    const b = byClass.get(l.taxClass) ?? { net: 0, tax: 0 };
    b.net += l.netCents;
    b.tax += l.taxCents;
    byClass.set(l.taxClass, b);
  }

  return (
    <Document title={`${doc.number} — ${org.name}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ maxWidth: 260 }}>
            {org.logoUrl ? <Image style={s.logo} src={org.logoUrl} /> : null}
            <Text style={s.orgName}>{org.name}</Text>
            {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
            {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
            {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
            {org.kraPin ? (
              <Text style={{ marginTop: 3 }}>
                KRA PIN: <Text style={s.bold}>{org.kraPin}</Text>
              </Text>
            ) : null}
          </View>
          <View>
            <Text style={s.docTitle}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
            <View style={s.metaRight}>
              <Text>
                No: <Text style={s.bold}>{doc.number}</Text>
              </Text>
              <Text>Date: {doc.date}</Text>
              {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
              {doc.status === "paid" ? (
                <Text style={{ color: "#1f8a4c", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Bill to */}
        <View style={s.billTo}>
          <Text style={s.sectionLabel}>{doc.type === "quote" ? "Quote for" : "Bill to"}</Text>
          <Text style={s.bold}>{contact?.displayName ?? "Walk-in customer"}</Text>
          {contact?.address ? <Text style={s.muted}>{contact.address}</Text> : null}
          {contact?.city ? <Text style={s.muted}>{contact.city}</Text> : null}
          {contact?.kraPin ? (
            <Text>
              Buyer PIN: <Text style={s.bold}>{contact.kraPin}</Text>
            </Text>
          ) : null}
        </View>

        {/* Line items */}
        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.th, s.cDesc]}>Description</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cPrice]}>Unit price</Text>
            <Text style={[s.th, s.cVat]}>VAT</Text>
            <Text style={[s.th, s.cAmount]}>Amount</Text>
          </View>
          {(() => {
            if (org.customDocumentColumnName) {
              const grouped = new Map<string, typeof lines>();
              for (const l of lines) {
                const cat = l.customColumnValue || "Uncategorized";
                if (!grouped.has(cat)) grouped.set(cat, []);
                grouped.get(cat)!.push(l);
              }
              const elements = [];
              for (const [cat, catLines] of grouped.entries()) {
                elements.push(
                  <View key={`cat-${cat}`} style={[s.tr, { backgroundColor: "#f5f5f7", borderBottom: "0.5px solid #d2d2d7" }]} wrap={false}>
                    <Text style={{ width: "100%", fontSize: 9, fontWeight: "bold", paddingHorizontal: 6, paddingVertical: 4 }}>{cat}</Text>
                  </View>
                );
                for (const l of catLines) {
                  elements.push(
                    <View style={s.tr} key={`line-${cat}-${l.description}-${l.qty}-${elements.length}`} wrap={false}>
                      <Text style={s.cDesc}>{l.description}</Text>
                      <Text style={s.cQty}>{l.qty}</Text>
                      <Text style={s.cPrice}>{fmtKES(l.unitPriceCents)}</Text>
                      <Text style={s.cVat}>
                        {TAX_CLASSES[l.taxClass as TaxClass]?.etimsCode ?? ""} ({(l.taxRateBp / 100).toFixed(0)}%)
                      </Text>
                      <Text style={s.cAmount}>{fmtKES(l.grossCents)}</Text>
                    </View>
                  );
                }
              }
              return <>{elements}</>;
            }

            return lines.map((l, i) => (
              <View style={s.tr} key={i} wrap={false}>
                <Text style={s.cDesc}>{l.description}</Text>
                <Text style={s.cQty}>{l.qty}</Text>
                <Text style={s.cPrice}>{fmtKES(l.unitPriceCents)}</Text>
                <Text style={s.cVat}>
                  {TAX_CLASSES[l.taxClass as TaxClass]?.etimsCode ?? ""} ({(l.taxRateBp / 100).toFixed(0)}%)
                </Text>
                <Text style={s.cAmount}>{fmtKES(l.grossCents)}</Text>
              </View>
            ));
          })()}
        </View>

        {/* VAT summary + totals */}
        <View style={s.bottomRow}>
          <View>
            <Text style={s.sectionLabel}>VAT summary</Text>
            {[...byClass.entries()].map(([cls, v]) => (
              <Text key={cls} style={{ paddingVertical: 1.5 }}>
                {TAX_CLASSES[cls as TaxClass]?.label ?? cls}: {fmtKES(v.net)} · VAT {fmtKES(v.tax)}
              </Text>
            ))}
          </View>
          <View style={s.totals}>
            <View style={s.totalLine}>
              <Text style={s.muted}>Subtotal</Text>
              <Text>{fmtKES(doc.subtotalCents)}</Text>
            </View>
            <View style={s.totalLine}>
              <Text style={s.muted}>VAT</Text>
              <Text>{fmtKES(doc.taxCents)}</Text>
            </View>
            <View style={s.grandTotal}>
              <Text style={s.grandText}>Total</Text>
              <Text style={s.grandText}>{fmtKES(doc.totalCents)}</Text>
            </View>
            {doc.paidCents > 0 ? (
              <>
                <View style={s.totalLine}>
                  <Text style={{ color: "#1f8a4c" }}>Paid</Text>
                  <Text style={{ color: "#1f8a4c" }}>−{fmtKES(doc.paidCents)}</Text>
                </View>
                <View style={s.totalLine}>
                  <Text style={s.bold}>Balance due</Text>
                  <Text style={s.bold}>{fmtKES(doc.totalCents - doc.paidCents)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Notes */}
        {doc.notes ? (
          <View style={{ marginTop: 20 }}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={s.muted}>{doc.notes}</Text>
          </View>
        ) : null}

        {/* Custom footer text */}
        {org.documentFooterText ? (
          <View style={s.docFooterText}>
            <Text>{org.documentFooterText}</Text>
          </View>
        ) : null}

        {/* Footer: eTIMS + QR */}
        <View style={s.footer} fixed>
          <View>
            {doc.type === "invoice" && doc.cuSerial ? (
              <>
                <Text style={s.muted}>CU Serial: {doc.cuSerial}</Text>
                <Text>
                  CU Invoice No: <Text style={s.bold}>{doc.cuInvoiceNumber ?? "—"}</Text>
                </Text>
                <Text style={s.demoTag}>DEMO: simulated control unit — not a fiscal document</Text>
              </>
            ) : (
              <Text style={s.muted}>{org.name}</Text>
            )}
          </View>
          {qrDataUrl ? (
            <View>
              <Image style={s.qr} src={qrDataUrl} />
              <Text style={[s.muted, { fontSize: 6.5, textAlign: "center", marginTop: 2 }]}>
                Scan to verify with KRA
              </Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
