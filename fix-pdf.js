const fs = require("fs");
let content = fs.readFileSync("src/lib/pdf/DocumentPdf.tsx", "utf8");

content = content.replace(
  `export interface PdfOrg {`,
  `export interface PdfOrg {\n  invoiceTemplate?: string | null;\n  quoteTemplate?: string | null;`
);

content = content.replace(
  `const s = makeStyles(org.brandColor || "#0f766e");`,
  `const s = makeStyles(org.brandColor || "#0f766e");
  
  let template = "default";
  if (doc.type === "invoice") template = org.invoiceTemplate || "default";
  else if (doc.type === "quote") template = org.quoteTemplate || "default";
  // "default", "classic", "modern", "bold"`
);

// We'll replace the Header section with the conditional rendering logic.
const headerMatch = content.match(/\{\/\* Header \*\/\}([\s\S]*?)\{\/\* Bill to \*\/\}/);
if (!headerMatch) throw new Error("Header not found");

const originalHeader = headerMatch[1].trim();

const newHeader = `{/* Modern Background */}
        {template === "modern" && <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 155, backgroundColor: org.brandColor }} />}
        
        {/* Bold Sidebar */}
        {template === "bold" && <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 20, backgroundColor: org.brandColor }} />}

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

        {template === "classic" && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1d1d1f", paddingBottom: 16, marginBottom: 16 }}>
              {org.logoUrl ? <Image style={[s.logo, { objectPosition: "center", marginHorizontal: "auto" }]} src={org.logoUrl} /> : null}
              <Text style={[s.orgName, { fontSize: 18 }]}>{org.name}</Text>
              {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
              {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
              {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
              {org.kraPin ? <Text style={{ marginTop: 3 }}>KRA PIN: <Text style={s.bold}>{org.kraPin}</Text></Text> : null}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                 <Text style={[s.docTitle, { textAlign: "left", color: "#1d1d1f" }]}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
              </View>
              <View style={{ textAlign: "right", lineHeight: 1.5 }}>
                <Text>No: <Text style={s.bold}>{doc.number}</Text></Text>
                <Text>Date: {doc.date}</Text>
                {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
              </View>
            </View>
          </View>
        )}

        {template === "modern" && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 40 }}>
            <View style={{ maxWidth: 260, color: "white" }}>
              {org.logoUrl ? <Image style={s.logo} src={org.logoUrl} /> : null}
              <Text style={[s.orgName, { color: "white" }]}>{org.name}</Text>
              {org.address ? <Text style={{ color: "white", opacity: 0.8 }}>{org.address}</Text> : null}
              {org.phone ? <Text style={{ color: "white", opacity: 0.8 }}>{org.phone}</Text> : null}
              {org.email ? <Text style={{ color: "white", opacity: 0.8 }}>{org.email}</Text> : null}
              {org.kraPin ? <Text style={{ marginTop: 3, color: "white" }}>KRA PIN: <Text style={{ fontFamily: "Helvetica-Bold" }}>{org.kraPin}</Text></Text> : null}
            </View>
            <View>
              <Text style={[s.docTitle, { color: "white", fontSize: 22 }]}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
              <View style={[s.metaRight, { color: "white" }]}>
                <Text>No: <Text style={{ fontFamily: "Helvetica-Bold" }}>{doc.number}</Text></Text>
                <Text>Date: {doc.date}</Text>
                {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                {doc.status === "paid" ? <Text style={{ color: "#a7f3d0", fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
              </View>
            </View>
          </View>
        )}

        {template === "bold" && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 10, marginBottom: 24 }}>
            <View style={{ maxWidth: 260 }}>
              {org.logoUrl ? <Image style={s.logo} src={org.logoUrl} /> : null}
              <Text style={s.orgName}>{org.name}</Text>
              {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
              {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
              {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
              {org.kraPin ? <Text style={{ marginTop: 3 }}>KRA PIN: <Text style={s.bold}>{org.kraPin}</Text></Text> : null}
            </View>
            <View>
              <Text style={[s.docTitle, { color: "#1d1d1f", fontSize: 24 }]}>{titles[doc.type] ?? doc.type.toUpperCase()}</Text>
              <View style={s.metaRight}>
                <Text>No: <Text style={s.bold}>{doc.number}</Text></Text>
                <Text>Date: {doc.date}</Text>
                {doc.dueDate ? <Text>Due: {doc.dueDate}</Text> : null}
                {doc.status === "paid" ? <Text style={{ color: org.brandColor, fontFamily: "Helvetica-Bold", marginTop: 2 }}>PAID</Text> : null}
              </View>
            </View>
          </View>
        )}

        {/* Bill to */}`;

content = content.replace(headerMatch[0], newHeader);

// Adjust Bill To for "bold" template to add padding
const billToMatch = content.match(/\{\/\* Bill to \*\/\}([\s\S]*?)\{\/\* Line items \*\/\}/);
let newBillTo = billToMatch[1];
newBillTo = `{/* Bill to */}
        <View style={[s.billTo, template === "bold" && { paddingLeft: 10 }]}>
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

        {/* Line items */}`;
content = content.replace(billToMatch[0], newBillTo);

// Also we need to adjust line items, totals and footer for "bold"
// We'll just wrap the whole middle section in a View for "bold" or add padding to specific blocks.
// Let's modify s.table, s.bottomRow, s.footer?
// Adding padding to the whole page would be easier but we already use absolute positioning for bold sidebar so it's fine.
// I'll just change s.table, s.bottomRow to have paddingLeft: 10 if bold.
content = content.replace(
  `<View style={s.table}>`,
  `<View style={[s.table, template === "bold" && { paddingLeft: 10 }]}>`
);
content = content.replace(
  `<View style={s.bottomRow}>`,
  `<View style={[s.bottomRow, template === "bold" && { paddingLeft: 10 }]}>`
);
content = content.replace(
  `{["invoice", "quote", "credit_note"].includes(doc.type) && doc.notes ? (
          <View style={{ marginTop: 20 }}>`,
  `{["invoice", "quote", "credit_note"].includes(doc.type) && doc.notes ? (
          <View style={[{ marginTop: 20 }, template === "bold" && { paddingLeft: 10 }]}>`
);
content = content.replace(
  `<View style={s.docFooterText}>`,
  `<View style={[s.docFooterText, template === "bold" && { paddingLeft: 10 }]}>`
);

// Footer: eTIMS + QR is absolutely positioned
content = content.replace(
  `<View style={s.footer} fixed>`,
  `<View style={[s.footer, template === "bold" && { left: 52 }]} fixed>` // 42 + 10 = 52
);

// Modern Template table header inversion
content = content.replace(
  `const elements = [];`,
  `const isModern = template === "modern";
              const thBg = isModern ? "#f5f5f7" : brand;
              const thText = isModern ? "#1d1d1f" : "#ffffff";
              
              const elements = [];`
);

content = content.replace(
  `<View style={s.thRow}>
            <Text style={[s.th, s.cDesc]}>Description</Text>
            <Text style={[s.th, s.cQty]}>Qty</Text>
            <Text style={[s.th, s.cPrice]}>Unit price</Text>
            <Text style={[s.th, s.cVat]}>VAT</Text>
            <Text style={[s.th, s.cAmount]}>Amount</Text>
          </View>`,
  `{(() => {
            const isModern = template === "modern";
            const thStyle = {
              backgroundColor: isModern ? "#f5f5f7" : org.brandColor || "#0f766e",
              color: isModern ? "#1d1d1f" : "#ffffff",
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
          })()}`
);

fs.writeFileSync("src/lib/pdf/DocumentPdf.tsx", content);
console.log("Done");
