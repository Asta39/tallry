import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface ReportPdfProps {
  title: string;
  subtitle?: string;
  orgName: string;
  dateStr?: string;
  columns: { header: string; align: "left" | "right" | "center"; widthPct?: number }[];
  rows: {
    id: string;
    cells: string[];
    isHeader?: boolean;
    isBold?: boolean;
    isIndent?: boolean;
  }[];
}

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingLeft: 42,
    paddingRight: 42,
    paddingBottom: 60,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#1d1d1f",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#d2d2d7",
    paddingBottom: 10,
  },
  orgName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  subtitle: { fontSize: 10, color: "#6e6e73", marginTop: 4 },
  table: { marginTop: 10 },
  thRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#0f766e",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  th: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f766e",
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8ed",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  cell: {
    fontSize: 9.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 42,
    right: 42,
    borderTopWidth: 0.5,
    borderTopColor: "#d2d2d7",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#86868b",
  },
});

export function ReportPdf({ title, subtitle, orgName, dateStr, columns, rows }: ReportPdfProps) {
  // If no widthPct is provided, divide evenly
  const getWidth = (col: typeof columns[0]) => {
    return col.widthPct ? `${col.widthPct}%` : `${100 / columns.length}%`;
  };

  return (
    <Document title={`${title} — ${orgName}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.orgName}>{orgName}</Text>
          <Text style={s.title}>{title}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        </View>

        <View style={s.table}>
          <View style={s.thRow}>
            {columns.map((c, i) => (
              <Text key={i} style={[s.th, { width: getWidth(c), textAlign: c.align }]}>
                {c.header}
              </Text>
            ))}
          </View>
          {rows.map((r, rowIndex) => {
            const rowStyle: any = [s.tr];
            if (r.isHeader) {
              rowStyle.push({ backgroundColor: "#f5f5f7", borderBottomWidth: 1, borderBottomColor: "#d2d2d7", marginTop: 8 });
            }
            return (
              <View style={rowStyle} key={r.id || `row-${rowIndex}`} wrap={false}>
                {r.cells.map((cellText, colIndex) => {
                  const col = columns[colIndex];
                  const cellStyle: any = [
                    s.cell,
                    { width: getWidth(col), textAlign: col.align },
                  ];
                  if (r.isHeader || r.isBold) {
                    cellStyle.push({ fontFamily: "Helvetica-Bold" });
                  }
                  if (colIndex === 0 && r.isIndent) {
                    cellStyle.push({ paddingLeft: 12 });
                  }
                  return (
                    <Text key={colIndex} style={cellStyle}>
                      {cellText}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>

        <View style={s.footer} fixed>
          <Text>{orgName} — {title}</Text>
          <Text>{dateStr || new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}
