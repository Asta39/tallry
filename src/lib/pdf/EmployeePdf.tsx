import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { fmtKES } from "@/lib/money";

export interface PdfEmployeeData {
  orgName: string;
  brandColor: string;
  employeeName: string;
  basicSalaryCents: number;
  kraPin: string | null;
  nssfNumber: string | null;
  shifNumber: string | null;
  isActive: boolean;
  createdAt: string;
  loans: {
    issueDate: string;
    principalCents: number;
    status: string;
  }[];
  payslips: {
    month: string;
    grossPayCents: number;
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
    
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    label: { color: "#6e6e73" },
    value: { fontFamily: "Helvetica-Bold" },
    
    tableHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e8e8ed", paddingBottom: 4, marginBottom: 8 },
    tableHeaderCell: { fontFamily: "Helvetica-Bold", color: "#6e6e73", fontSize: 9 },
    
    tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    tableLabel: { width: "40%" },
    tableValue: { width: "30%", textAlign: "center" },
    tableAmount: { width: "30%", textAlign: "right" },
    
    footer: { position: "absolute", bottom: 48, left: 48, right: 48, fontSize: 8, color: "#86868b", textAlign: "center" }
  });
}

export function EmployeePdf({ data }: { data: PdfEmployeeData }) {
  const s = makeStyles(data.brandColor || "#0f766e");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.orgName}>{data.orgName}</Text>
          <Text style={s.title}>Employee Profile</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Details</Text>
          <View style={s.row}>
            <Text style={s.label}>Employee Name:</Text>
            <Text style={s.value}>{data.employeeName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Basic Salary:</Text>
            <Text style={s.value}>{fmtKES(data.basicSalaryCents)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Status:</Text>
            <Text style={s.value}>{data.isActive ? "Active" : "Suspended"}</Text>
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
          <View style={s.row}>
            <Text style={s.label}>Registered:</Text>
            <Text style={s.value}>{data.createdAt}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Active Loans</Text>
          {data.loans.length === 0 ? (
            <Text style={s.label}>No loans on record.</Text>
          ) : (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, s.tableLabel]}>Issue Date</Text>
                <Text style={[s.tableHeaderCell, s.tableValue]}>Status</Text>
                <Text style={[s.tableHeaderCell, s.tableAmount]}>Principal</Text>
              </View>
              {data.loans.map((l, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={s.tableLabel}>{l.issueDate}</Text>
                  <Text style={s.tableValue}>{l.status === "active" ? "Active" : "Cleared"}</Text>
                  <Text style={s.tableAmount}>{fmtKES(l.principalCents)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Payslips</Text>
          {data.payslips.length === 0 ? (
            <Text style={s.label}>No payslips generated yet.</Text>
          ) : (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, s.tableLabel]}>Month</Text>
                <Text style={[s.tableHeaderCell, s.tableAmount]}>Gross Pay</Text>
              </View>
              {data.payslips.map((p, i) => (
                <View key={i} style={s.tableRow}>
                  <Text style={s.tableLabel}>{p.month}</Text>
                  <Text style={s.tableAmount}>{fmtKES(p.grossPayCents)}</Text>
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
