import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";

export interface PdfPayslipData {
  orgName: string;
  brandColor: string;
  month: string;
  employeeName: string;
  kraPin: string | null;
  nssfNumber: string | null;
  shifNumber: string | null;
  grossPayCents: number;
  nssfCents: number;
  shifCents: number;
  housingLevyCents: number;
  payeCents: number;
  netPayCents: number;
}

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1d1d1f" },
    header: { marginBottom: 32, borderBottomWidth: 1, borderBottomColor: brand, paddingBottom: 16 },
    orgName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: brand },
    title: { fontSize: 14, marginTop: 4, color: "#6e6e73" },
    
    section: { marginBottom: 24 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    label: { color: "#6e6e73" },
    value: { fontFamily: "Helvetica-Bold" },
    
    tableHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e8e8ed", paddingBottom: 4, marginBottom: 8 },
    tableHeaderCell: { fontFamily: "Helvetica-Bold", color: "#6e6e73", fontSize: 9 },
    
    tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    tableLabel: { width: "70%" },
    tableAmount: { width: "30%", textAlign: "right" },
    
    totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e8e8ed" },
    totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
    totalAmount: { fontFamily: "Helvetica-Bold", fontSize: 11, color: brand },
    
    footer: { position: "absolute", bottom: 48, left: 48, right: 48, fontSize: 8, color: "#86868b", textAlign: "center" }
  });
}

export function PayslipPdf({ data }: { data: PdfPayslipData }) {
  const s = makeStyles(data.brandColor || "#0f766e");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.orgName}>{data.orgName}</Text>
          <Text style={s.title}>Payslip - {data.month}</Text>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.label}>Employee Name:</Text>
            <Text style={s.value}>{data.employeeName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>KRA PIN:</Text>
            <Text style={s.value}>{data.kraPin || "N/A"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>NSSF Number:</Text>
            <Text style={s.value}>{data.nssfNumber || "N/A"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>SHIF Number:</Text>
            <Text style={s.value}>{data.shifNumber || "N/A"}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.tableHeader}>
            <Text style={s.tableHeaderCell}>Earnings</Text>
            <Text style={[s.tableHeaderCell, { textAlign: "right" }]}>Amount</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Basic Salary</Text>
            <Text style={s.tableAmount}>{fmtKES(data.grossPayCents)}</Text>
          </View>
          
          <View style={[s.tableHeader, { marginTop: 16 }]}>
            <Text style={s.tableHeaderCell}>Deductions</Text>
            <Text style={[s.tableHeaderCell, { textAlign: "right" }]}>Amount</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>PAYE (Tax)</Text>
            <Text style={s.tableAmount}>{fmtKES(data.payeCents)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>NSSF (Pension)</Text>
            <Text style={s.tableAmount}>{fmtKES(data.nssfCents)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>SHIF (Health)</Text>
            <Text style={s.tableAmount}>{fmtKES(data.shifCents)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Affordable Housing Levy</Text>
            <Text style={s.tableAmount}>{fmtKES(data.housingLevyCents)}</Text>
          </View>

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Net Pay</Text>
            <Text style={s.totalAmount}>{fmtKES(data.netPayCents)}</Text>
          </View>
        </View>

        <Text style={s.footer}>This is a computer generated document.</Text>
      </Page>
    </Document>
  );
}
