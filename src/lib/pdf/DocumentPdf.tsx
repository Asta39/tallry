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
  invoiceTemplate?: string | null;
  quoteTemplate?: string | null;
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
  expense: "EXPENSE",
  bill: "BILL",
  purchase_order: "PURCHASE ORDER",
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
  
  let template = "default";
  if (doc.type === "invoice") template = org.invoiceTemplate || "default";
  else if (doc.type === "quote") template = org.quoteTemplate || "default";
  // "default", "classic", "modern", "bold"
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
        {/* Backgrounds */}
        {template === "beige" && <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0, backgroundColor: "#fdfbf7" }} />}
        {template === "pastel" && <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0, backgroundColor: org.brandColor, opacity: 0.05 }} />}
        {template === "sleek" && <View style={{ position: "absolute", top: 10, left: 10, bottom: 10, right: 10, border: "2px solid #1d1d1f" }} />}

        {/* Header */}
        {template === "default" && (
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
        )}

        {template === "accent" && (
          <View style={{ marginBottom: 30 }}>
            {/* Header dark block */}
            <View style={{ backgroundColor: "#2d2d2d", padding: 30, flexDirection: "row", justifyContent: "space-between", marginHorizontal: -42, marginTop: -42, paddingHorizontal: 42 }}>
               <View style={{ maxWidth: 220 }}>
                 {org.logoUrl ? <Image style={s.logo} src={org.logoUrl} /> : null}
                 <Text style={[s.orgName, { color: "#ffffff" }]}>{org.name}</Text>
                 {org.kraPin ? <Text style={{ marginTop: 3, color: "#ffffff", opacity: 0.8, fontSize: 8 }}>KRA PIN: {org.kraPin}</Text> : null}
               </View>
               <View>
                 <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "right" }}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
                 <Text style={{ textAlign: "right", color: "#ffffff", opacity: 0.8, marginTop: 4, fontSize: 9 }}>No: {doc.number}</Text>
               </View>
            </View>
            {/* Accent line */}
            <View style={{ height: 4, backgroundColor: org.brandColor, marginHorizontal: -42 }} />
            
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24 }}>
               <View>
                 <Text style={[s.docTitle, { textAlign: "left", fontSize: 9, color: "#1d1d1f", marginBottom: 4, textTransform: "uppercase" }]}>From:</Text>
                 <Text style={s.bold}>{org.name}</Text>
                 {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
                 {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
                 {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
               </View>
               <View style={{ textAlign: "right", lineHeight: 1.5 }}>
                 <Text>Date: {doc.date}</Text>
                 {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                 {doc.status === "paid" ? <Text style={{ color: "#1f8a4c", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
               </View>
            </View>
          </View>
        )}

        {template === "minimalist" && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e8e8ed", paddingBottom: 24 }}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {org.logoUrl ? (
                   <Image style={{ width: 50, height: 50, borderRadius: 25, objectFit: "cover" }} src={org.logoUrl} />
                ) : (
                   <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#1d1d1f", alignItems: "center", justifyContent: "center" }}>
                     <Text style={{ color: "#ffffff", fontSize: 20, fontFamily: "Helvetica-Bold" }}>{org.name.charAt(0)}</Text>
                   </View>
                )}
                <View>
                  <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold" }}>{org.name}</Text>
                  {org.kraPin ? <Text style={{ marginTop: 2, fontSize: 8 }}>KRA PIN: {org.kraPin}</Text> : null}
                </View>
              </View>
              <View>
                <Text style={{ fontSize: 28, fontFamily: "Helvetica", textAlign: "right", letterSpacing: 1, textTransform: "lowercase" }}>{doc.type}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
               <View>
                 <Text style={s.sectionLabel}>Office</Text>
                 {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
                 {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
                 {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
               </View>
               <View style={{ textAlign: "right", lineHeight: 1.5 }}>
                 <Text>No: <Text style={s.bold}>{doc.number}</Text></Text>
                 <Text>Date: {doc.date}</Text>
                 {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                 {doc.status === "paid" ? <Text style={{ color: "#1f8a4c", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
               </View>
            </View>
          </View>
        )}

        {template === "beige" && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <View>
                 {org.logoUrl ? <Image style={[s.logo, { marginBottom: 0 }]} src={org.logoUrl} /> : <Text style={[s.orgName, { fontSize: 22 }]}>{org.name}</Text>}
              </View>
              <Text style={[s.docTitle, { color: org.brandColor }]}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
               <View>
                 <Text style={s.bold}>{org.name}</Text>
                 {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
                 {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
                 {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
                 {org.kraPin ? <Text style={{ marginTop: 3 }}>KRA PIN: <Text style={s.bold}>{org.kraPin}</Text></Text> : null}
               </View>
               <View style={s.metaRight}>
                 <Text>No: <Text style={s.bold}>{doc.number}</Text></Text>
                 <Text>Date: {doc.date}</Text>
                 {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                 {doc.status === "paid" ? <Text style={{ color: "#1f8a4c", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
               </View>
            </View>
            <View style={{ height: 1, backgroundColor: "#1d1d1f", marginTop: 20 }} />
          </View>
        )}

        {template === "sleek" && (
          <View style={{ marginBottom: 12, marginTop: 10 }}>
             <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
               <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                 {org.logoUrl ? <Image style={{ width: 30, height: 30, objectFit: "contain" }} src={org.logoUrl} /> : <View style={{ width: 16, height: 16, backgroundColor: "#1d1d1f" }} />}
                 <Text style={[s.orgName, { fontSize: 18 }]}>{org.name}</Text>
               </View>
               <View>
                 <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
                 <Text style={{ fontSize: 8, textAlign: "right", marginTop: 4 }}>DATE: {doc.date} | NO: {doc.number}</Text>
                 {doc.status === "paid" ? <Text style={{ fontSize: 8, textAlign: "right", color: "#1f8a4c", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
               </View>
             </View>
             <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f5f5f7", padding: 10 }}>
               <View>
                 <Text style={[s.sectionLabel, { marginBottom: 4 }]}>From</Text>
                 {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
                 {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
                 {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
                 {org.kraPin ? <Text style={{ marginTop: 2, fontSize: 8 }}>KRA PIN: {org.kraPin}</Text> : null}
               </View>
             </View>
          </View>
        )}

        {template === "pastel" && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ maxWidth: 260 }}>
              {org.logoUrl ? <Image style={s.logo} src={org.logoUrl} /> : null}
              <Text style={[s.orgName, { color: org.brandColor, fontSize: 18 }]}>{org.name}</Text>
              {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
              {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
              {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
              {org.kraPin ? <Text style={{ marginTop: 3 }}>KRA PIN: <Text style={s.bold}>{org.kraPin}</Text></Text> : null}
            </View>
            <View>
              <Text style={[s.docTitle, { color: "#1d1d1f", fontSize: 24 }]}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
              <Text style={{ textAlign: "right", fontSize: 10, color: org.brandColor, marginTop: 4, fontFamily: "Helvetica-Bold" }}>{doc.date}</Text>
              <View style={s.metaRight}>
                <Text>No: <Text style={s.bold}>{doc.number}</Text></Text>
                {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                {doc.status === "paid" ? <Text style={{ color: org.brandColor, fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
              </View>
            </View>
          </View>
        )}

        {/* Bill to */}
        <View style={s.billTo}>
          <Text style={s.sectionLabel}>
            {["quote", "purchase_order"].includes(doc.type) ? "Quote for" : doc.type === "expense" ? "Expense for" : "Bill to"}
          </Text>
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
          {(() => {
            const isTinted = template === "pastel" || template === "beige";
            const isMinimal = template === "minimalist" || template === "sleek";
            const thStyle = {
              backgroundColor: isMinimal ? "#f5f5f7" : org.brandColor || "#0f766e",
              color: isMinimal ? "#1d1d1f" : "#ffffff",
            };
            return (
              <View style={[s.thRow, { backgroundColor: thStyle.backgroundColor }]}>
                <Text style={[s.th, s.cDesc, { color: thStyle.color }]}>Description</Text>
                <Text style={[s.th, s.cQty, { color: thStyle.color }]}>Qty</Text>
                <Text style={[s.th, s.cPrice, { color: thStyle.color }]}>Unit price</Text>
                <Text style={[s.th, s.cVat, { color: thStyle.color }]}>VAT</Text>
                <Text style={[s.th, s.cAmount, { color: thStyle.color }]}>Amount</Text>
              </View>
            );
          })()}
          {(() => {
            if (org.customDocumentColumnName) {
              const grouped = new Map<string, typeof lines>();
              for (const l of lines) {
                const cat = l.customColumnValue || "Uncategorized";
                if (!grouped.has(cat)) grouped.set(cat, []);
                grouped.get(cat)!.push(l);
              }
              const isTinted = template === "pastel" || template === "beige";
              const isMinimal = template === "minimalist" || template === "sleek";
              
              const thBg = isMinimal ? "#f5f5f7" : (isTinted ? org.brandColor : org.brandColor);
              const thText = isMinimal ? "#1d1d1f" : "#ffffff";
              
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
        {["invoice", "quote", "credit_note"].includes(doc.type) && doc.notes ? (
          <View style={{ marginTop: 20 }}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={s.muted}>{doc.notes}</Text>
          </View>
        ) : null}

        {/* Custom footer text */}
        {["invoice", "quote", "credit_note"].includes(doc.type) && org.documentFooterText ? (
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
