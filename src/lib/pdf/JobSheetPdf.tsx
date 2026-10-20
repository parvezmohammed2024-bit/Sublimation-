import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { JobSheetData } from "../jobSheet";

export interface JobSheetLabels {
  title: string; customer: string; stage: string; due: string; rush: string; qty: string;
  items: string; garment: string; fabric: string; collar: string; sleeve: string; cutting: string;
  sizes: string; noSizes: string; brief: string; notes: string; mockup: string; noMockup: string;
  balance: string; scan: string; orderDate: string; nonPoly: string;
}

export interface PdfItem {
  garment: string; fabric: string; collar: string; sleeve: string; cutting: string; qty: number;
  warn: boolean; extras: string;
}

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  jobNo: { fontSize: 26, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  qr: { width: 86, height: 86 },
  dueBox: { borderWidth: 2, borderColor: "#111", padding: 8, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dueLabel: { fontSize: 10, textTransform: "uppercase" },
  dueDate: { fontSize: 30, fontFamily: "Helvetica-Bold" },
  rush: { backgroundColor: "#b91c1c", color: "#fff", padding: "3 8", fontFamily: "Helvetica-Bold" },
  h: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#999", paddingVertical: 3 },
  head: { fontFamily: "Helvetica-Bold", backgroundColor: "#eee" },
  c1: { width: "28%" }, c2: { width: "22%" }, c3: { width: "16%" }, c4: { width: "12%" }, c5: { width: "12%" }, c6: { width: "10%", textAlign: "right" },
  sizeCell: { width: 48, borderWidth: 0.5, borderColor: "#999", padding: 4, textAlign: "center" },
  mock: { width: 150, height: 110, borderWidth: 0.5, borderColor: "#999", alignItems: "center", justifyContent: "center" },
  box: { borderWidth: 0.5, borderColor: "#999", padding: 6, minHeight: 50 },
  warn: { color: "#b45309" },
});

export function JobSheetPdf({
  data, qr, labels, items, mockupUrl,
}: {
  data: JobSheetData; qr: string; labels: JobSheetLabels; items: PdfItem[]; mockupUrl?: string | null;
}) {
  return (
    <Document title={`${labels.title} ${data.jobNo}`}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View>
            <Text style={s.jobNo}>{data.jobNo}</Text>
            <Text>{data.customer.organisation ?? data.customer.name}</Text>
            {data.customer.organisation && <Text style={s.muted}>{data.customer.name}</Text>}
            <Text style={s.muted}>{labels.orderDate}: {data.orderDate}</Text>
            <Text style={s.muted}>{labels.stage}: {data.stageLabel}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            {/* react-pdf Image: not an <img>, has no alt prop */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qr} style={s.qr} />
            <Text style={{ fontSize: 7 }}>{labels.scan}</Text>
          </View>
        </View>

        <View style={s.dueBox}>
          <View>
            <Text style={s.dueLabel}>{labels.due}</Text>
            <Text style={s.dueDate}>{data.dueDate ?? "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {data.priority === "rush" && <Text style={s.rush}>{labels.rush}</Text>}
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 }}>
              {data.totalQty} {labels.qty}
            </Text>
          </View>
        </View>

        <Text style={s.h}>{labels.items}</Text>
        <View style={[s.row, s.head]}>
          <Text style={s.c1}>{labels.garment}</Text><Text style={s.c2}>{labels.fabric}</Text>
          <Text style={s.c3}>{labels.collar}</Text><Text style={s.c4}>{labels.sleeve}</Text>
          <Text style={s.c5}>{labels.cutting}</Text><Text style={s.c6}>{labels.qty}</Text>
        </View>
        {items.map((i, n) => (
          <View key={n} wrap={false}>
            <View style={s.row}>
              <Text style={s.c1}>{i.garment}</Text><Text style={s.c2}>{i.fabric}</Text>
              <Text style={s.c3}>{i.collar}</Text><Text style={s.c4}>{i.sleeve}</Text>
              <Text style={s.c5}>{i.cutting}</Text><Text style={s.c6}>{i.qty}</Text>
            </View>
            {i.warn && <Text style={s.warn}>! {labels.nonPoly}</Text>}
            {i.extras ? <Text style={s.muted}>{i.extras}</Text> : null}
          </View>
        ))}

        <Text style={s.h}>{labels.sizes}</Text>
        {data.sizeBreakdown.length === 0 ? (
          <Text style={s.muted}>{labels.noSizes}</Text>
        ) : (
          <View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {data.sizeBreakdown.map((x) => (
                <Text key={x.size} style={[s.sizeCell, s.head]}>{x.size}</Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {data.sizeBreakdown.map((x) => (
                <Text key={x.size} style={s.sizeCell}>{x.qty}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          <View>
            <Text style={s.h}>{labels.mockup}</Text>
            <View style={s.mock}>
              {mockupUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={mockupUrl} style={{ width: 146, height: 106, objectFit: "contain" }} />
              ) : (
                <Text style={s.muted}>{labels.noMockup}</Text>
              )}
            </View>
          </View>
          <View style={{ flexGrow: 1 }}>
            <Text style={s.h}>{labels.brief}</Text>
            <View style={s.box}><Text>{data.designBrief ?? ""}</Text></View>
          </View>
        </View>

        <Text style={s.h}>{labels.notes}</Text>
        <View style={s.box}><Text>{data.internalNotes ?? ""}</Text></View>

        {data.balanceSen > 0 && (
          <Text style={[s.h, { color: "#b45309" }]}>
            {labels.balance}: RM {(data.balanceSen / 100).toFixed(2)}
          </Text>
        )}
      </Page>
    </Document>
  );
}
