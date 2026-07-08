import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export interface ReportPdfProps {
  title: string;
  subtitle?: string;
  orgName: string;
  brandColor?: string;
  logoUrl?: string;
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
    marginBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    paddingBottom: 16,
  },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },
  subtitle: { fontSize: 11, marginTop: 4 },
  logo: { width: 60, height: 60, objectFit: "contain", marginBottom: 8 },
  table: { marginTop: 10 },
  thRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 4,
    backgroundColor: "#f5f5f7",
  },
  th: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
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

export function ReportPdf({ title, subtitle, orgName, brandColor, logoUrl, dateStr, columns, rows }: ReportPdfProps) {
  // If no widthPct is provided, divide evenly
  const getWidth = (col: typeof columns[0]) => {
    return col.widthPct ? `${col.widthPct}%` : `${100 / columns.length}%`;
  };

  const primaryColor = brandColor || "#1d1d1f";

  return (
    <Document title={`${title} — ${orgName}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: primaryColor }]}>
          <View>
            {logoUrl && <Image src={logoUrl} style={s.logo} />}
            <Text style={[s.orgName, { color: primaryColor }]}>{orgName}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={[s.title, { color: primaryColor }]}>{title}</Text>
            {subtitle && <Text style={[s.subtitle, { color: "#86868b" }]}>{subtitle}</Text>}
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.thRow, { borderBottomColor: primaryColor }]}>
            {columns.map((c, i) => (
              <Text key={i} style={[s.th, { width: getWidth(c), textAlign: c.align, color: primaryColor }]}>
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
