import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";

export interface PdfLoanData {
  orgName: string;
  brandColor: string;
  employeeName: string;
  loanId: number;
  principalCents: number;
  status: string;
  issueDate: string;
  totalPaid: number;
  remainingBalance: number;
  installments: {
    month: string;
    amountCents: number;
    isPaid: boolean;
  }[];
}

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1d1d1f" },
    header: { marginBottom: 32, borderBottomWidth: 1, borderBottomColor: brand, paddingBottom: 16 },
    orgName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: brand },
    title: { fontSize: 14, marginTop: 4, color: "#6e6e73" },
    
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, color: brand },
    
    grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
    gridItem: { width: "50%", paddingBottom: 8 },
    label: { color: "#6e6e73" },
    value: { fontFamily: "Helvetica-Bold", marginTop: 2 },
    
    tableHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e8e8ed", paddingBottom: 4, marginBottom: 8 },
    tableHeaderCell: { fontFamily: "Helvetica-Bold", color: "#6e6e73", fontSize: 9 },
    
    tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    tableLabel: { width: "33%" },
    tableValue: { width: "33%", textAlign: "center" },
    tableAmount: { width: "33%", textAlign: "right" },
    
    footer: { position: "absolute", bottom: 48, left: 48, right: 48, fontSize: 8, color: "#86868b", textAlign: "center" }
  });
}

export function LoanPdf({ data }: { data: PdfLoanData }) {
  const s = makeStyles(data.brandColor || "#0f766e");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.orgName}>{data.orgName}</Text>
          <Text style={s.title}>Loan Statement - #{data.loanId}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Summary</Text>
          <View style={s.grid}>
            <View style={s.gridItem}>
              <Text style={s.label}>Employee Name:</Text>
              <Text style={s.value}>{data.employeeName}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Issue Date:</Text>
              <Text style={s.value}>{data.issueDate}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Principal Amount:</Text>
              <Text style={s.value}>{fmtKES(data.principalCents)}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Status:</Text>
              <Text style={s.value}>{data.status === "active" ? "Active" : "Cleared"}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Total Repaid:</Text>
              <Text style={s.value}>{fmtKES(data.totalPaid)}</Text>
            </View>
            <View style={s.gridItem}>
              <Text style={s.label}>Remaining Balance:</Text>
              <Text style={[s.value, { color: "#e30000" }]}>{fmtKES(data.remainingBalance)}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Amortization Schedule</Text>
          {data.installments.length === 0 ? (
            <Text style={s.label}>No installments found.</Text>
          ) : (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, s.tableLabel]}>Month</Text>
                <Text style={[s.tableHeaderCell, s.tableValue]}>Status</Text>
                <Text style={[s.tableHeaderCell, s.tableAmount]}>Amount</Text>
              </View>
              {data.installments.map((inst, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={s.tableLabel}>{inst.month}</Text>
                  <Text style={s.tableValue}>{inst.isPaid ? "Paid" : "Pending"}</Text>
                  <Text style={s.tableAmount}>{fmtKES(inst.amountCents)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={s.footer}>Generated on {new Date().toLocaleDateString()}</Text>
      </Page>
    </Document>
  );
}
