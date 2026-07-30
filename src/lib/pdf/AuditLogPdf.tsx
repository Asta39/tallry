import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface AuditLogPdfRow {
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  recordLabel: string;
  detail: string;
}

export interface AuditLogPdfData {
  orgName: string;
  brandColor: string;
  generatedAt: string;
  filterSummary: string;
  rows: AuditLogPdfRow[];
  totalCount: number;
}

function makeStyles(brand: string) {
  return StyleSheet.create({
    page: { padding: 40, fontSize: 8.5, fontFamily: "Helvetica", color: "#1d1d1f" },
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: brand, paddingBottom: 14 },
    orgName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: brand },
    title: { fontSize: 12, marginTop: 3, color: "#6e6e73" },
    meta: { fontSize: 8, marginTop: 6, color: "#86868b" },

    tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8e8ed", paddingBottom: 4, marginBottom: 4 },
    tableHeaderCell: { fontFamily: "Helvetica-Bold", color: "#6e6e73", fontSize: 7.5 },
    tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f0f0f2" },

    cWhen: { width: "14%" },
    cWho: { width: "16%" },
    cAction: { width: "12%" },
    cModule: { width: "13%" },
    cRecord: { width: "16%" },
    cDetail: { width: "29%" },

    footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#86868b", textAlign: "center" },
  });
}

export function AuditLogPdf({ data }: { data: AuditLogPdfData }) {
  const s = makeStyles(data.brandColor || "#0f766e");
  return (
    <Document>
      <Page size="A4" style={s.page} orientation="landscape">
        <View style={s.header}>
          <Text style={s.orgName}>{data.orgName}</Text>
          <Text style={s.title}>Audit Log</Text>
          <Text style={s.meta}>{data.filterSummary} · {data.totalCount} entries · Generated {data.generatedAt}</Text>
        </View>

        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.cWhen]}>When</Text>
          <Text style={[s.tableHeaderCell, s.cWho]}>Who</Text>
          <Text style={[s.tableHeaderCell, s.cAction]}>Action</Text>
          <Text style={[s.tableHeaderCell, s.cModule]}>Module</Text>
          <Text style={[s.tableHeaderCell, s.cRecord]}>Record</Text>
          <Text style={[s.tableHeaderCell, s.cDetail]}>Detail</Text>
        </View>
        {data.rows.map((r, i) => (
          <View key={i} style={s.tableRow} wrap={false}>
            <Text style={s.cWhen}>{r.createdAt.replace("T", " ").slice(0, 19)}</Text>
            <Text style={s.cWho}>{r.actorName} ({r.actorRole})</Text>
            <Text style={s.cAction}>{r.action}</Text>
            <Text style={s.cModule}>{r.module}</Text>
            <Text style={s.cRecord}>{r.recordLabel}</Text>
            <Text style={s.cDetail}>{r.detail}</Text>
          </View>
        ))}

        <Text style={s.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
