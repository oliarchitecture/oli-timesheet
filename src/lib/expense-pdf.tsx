import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORTATION: "Transportation",
  MEALS: "Meals/Office",
  MEALS_USA: "Meals/USA",
  MEALS_CHINA: "Meals/China",
  ACCOMMODATION: "Accommodation",
  OTHER: "Other",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 12,
  },
  firmName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  firmAddress: {
    fontSize: 8,
    color: "#666",
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    color: "#1a1a1a",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
    gap: 8,
  },
  metaLabel: {
    fontSize: 8,
    color: "#888",
    width: 60,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thDate: { width: 62, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  thProject: { flex: 1.2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  thCategory: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  thDescription: { flex: 2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  thAmount: { width: 60, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", textAlign: "right" },
  tdDate: { width: 62, fontSize: 8, color: "#333" },
  tdProject: { flex: 1.2, fontSize: 8, color: "#333" },
  tdCategory: { flex: 1, fontSize: 8, color: "#333" },
  tdDescription: { flex: 2, fontSize: 8, color: "#333" },
  tdAmount: { width: 60, fontSize: 8, color: "#333", textAlign: "right" },
  totalsSection: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginBottom: 3,
  },
  totalLabel: { fontSize: 8, color: "#555", width: 80, textAlign: "right" },
  totalValue: { fontSize: 8, color: "#1a1a1a", width: 60, textAlign: "right" },
  totalDueLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1a1a1a", width: 80, textAlign: "right" },
  totalDueValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#C8922A", width: 60, textAlign: "right" },
  divider: { height: 1, backgroundColor: "#e5e5e5", marginVertical: 6, width: 156, alignSelf: "flex-end" },
  notesSection: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 4,
  },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#555", marginBottom: 4 },
  notesText: { fontSize: 8, color: "#333", lineHeight: 1.4 },
  receiptPage: {
    padding: 30,
    backgroundColor: "#fff",
  },
  receiptHeader: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 6,
  },
  receiptImage: {
    maxWidth: "100%",
    objectFit: "contain",
  },
});

export interface ExpensePDFItem {
  date: Date | string;
  projectName: string;
  category: string;
  otherDescription: string | null;
  description: string;
  amount: number;
}

export interface ExpensePDFReceipt {
  fileName: string;
  dataUrl: string;
}

interface ExpensePDFDocumentProps {
  employeeName: string;
  month: number;
  year: number;
  items: ExpensePDFItem[];
  advanceAmount: number;
  notes: string | null;
  imageReceipts: ExpensePDFReceipt[];
}

function formatAmount(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function categoryLabel(category: string, other: string | null) {
  if (category === "OTHER") return `Other${other ? `: ${other}` : ""}`;
  return CATEGORY_LABELS[category] ?? category;
}

export function ExpensePDFDocument({
  employeeName,
  month,
  year,
  items,
  advanceAmount,
  notes,
  imageReceipts,
}: ExpensePDFDocumentProps) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const amountDue = total - advanceAmount;
  const monthName = MONTH_NAMES[month - 1];

  return (
    <Document>
      {/* Summary page */}
      <Page size="LETTER" style={styles.page}>
        {/* Firm header */}
        <View style={styles.header}>
          <Text style={styles.firmName}>OLI Architecture</Text>
          <Text style={styles.firmAddress}>6 West 18th Street, 2A, New York, NY 10011  ·  Tel: 212 675 0555</Text>
        </View>

        <Text style={styles.title}>EXPENSE REPORT</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Name:</Text>
          <Text style={styles.metaValue}>{employeeName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Period:</Text>
          <Text style={styles.metaValue}>{monthName} {year}</Text>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.thDate}>Date</Text>
            <Text style={styles.thProject}>Project</Text>
            <Text style={styles.thCategory}>Category</Text>
            <Text style={styles.thDescription}>Description</Text>
            <Text style={styles.thAmount}>Amount</Text>
          </View>
          {items.map((item, i) => (
            <View
              key={i}
              style={i === items.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.tdDate}>{formatDate(item.date)}</Text>
              <Text style={styles.tdProject}>{item.projectName}</Text>
              <Text style={styles.tdCategory}>{categoryLabel(item.category, item.otherDescription)}</Text>
              <Text style={styles.tdDescription}>{item.description}</Text>
              <Text style={styles.tdAmount}>{formatAmount(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatAmount(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Less Advance</Text>
            <Text style={styles.totalValue}>{formatAmount(advanceAmount)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalDueLabel}>Amount Due</Text>
            <Text style={styles.totalDueValue}>{formatAmount(amountDue)}</Text>
          </View>
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {/* Receipt reference */}
        {imageReceipts.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 8, color: "#888" }}>
              {imageReceipts.length} receipt image{imageReceipts.length !== 1 ? "s" : ""} attached on following page{imageReceipts.length !== 1 ? "s" : ""}.
            </Text>
          </View>
        )}
      </Page>

      {/* One page per image receipt */}
      {imageReceipts.map((receipt, i) => (
        <Page key={i} size="LETTER" style={styles.receiptPage}>
          <Text style={styles.receiptHeader}>
            Receipt {i + 1} of {imageReceipts.length}: {receipt.fileName}
          </Text>
          <Image src={receipt.dataUrl} style={styles.receiptImage} />
        </Page>
      ))}
    </Document>
  );
}
