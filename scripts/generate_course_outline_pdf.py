import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to add 'Page X of Y' footers and running headers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            # Suppress header/footer on cover page
            return

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#4A5568"))

        # Running Header
        self.drawString(54, letter[1] - 36, "BIASHARA ERP — COMPLETE SYSTEM REFERENCE & COURSE OUTLINE")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Running Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#718096"))
        self.drawString(54, 36, "Confidential & Proprietary — Biashara Enterprise ERP Documentation")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 36, page_str)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.line(54, 48, letter[0] - 54, 48)

        self.restoreState()

def build_pdf(filename="Biashara_ERP_Complete_Course_Outline_and_System_Documentation.pdf"):
    pdf_path = os.path.abspath(filename)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Color Palette
    PRIMARY = colors.HexColor("#1E3A8A")    # Deep Navy
    SECONDARY = colors.HexColor("#0D9488")  # Teal Accent
    DARK_TEXT = colors.HexColor("#0F172A")  # Slate 900
    LIGHT_BG = colors.HexColor("#F8FAFC")   # Slate 50
    BORDER_COLOR = colors.HexColor("#CBD5E1") # Slate 300

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=PRIMARY,
        spaceAfter=10
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#475569"),
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK_TEXT,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=4
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=DARK_TEXT
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=PRIMARY
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B")
    )

    story = []

    # -------------------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------------------
    story.append(Spacer(1, 40))
    story.append(Paragraph("BIASHARA ERP SYSTEM", ParagraphStyle('Badge', fontName='Helvetica-Bold', fontSize=10, textColor=SECONDARY, leading=12, spaceAfter=8)))
    story.append(Paragraph("Comprehensive Course Outline & System Reference Manual", title_style))
    story.append(Paragraph("An end-to-end screen-by-screen guide, module architectural reference, and operational standard operating procedure (SOP) for Biashara Enterprise ERP.", subtitle_style))
    
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceBefore=5, spaceAfter=20))

    # Metadata Box
    meta_data = [
        [Paragraph("<b>Target Audience:</b>", table_cell_bold), Paragraph("Business Owners, Financial Controllers, Accountants, Operations Managers & Systems Administrators", table_cell_style)],
        [Paragraph("<b>Regional Compliance:</b>", table_cell_bold), Paragraph("Kenya & East Africa (Kenyan Shillings KES, KRA VAT 16%, SHIF/NHIF, PAYE, Housing Levy, NSSF)", table_cell_style)],
        [Paragraph("<b>System Coverage:</b>", table_cell_bold), Paragraph("10 Core Modules | 65+ Dedicated Screens & Routes | Full Accounting & CRM Lifecycle", table_cell_style)],
        [Paragraph("<b>Document Version:</b>", table_cell_bold), Paragraph("Version 2.4 (Production Release)", table_cell_style)],
        [Paragraph("<b>Last Updated:</b>", table_cell_bold), Paragraph("July 2026", table_cell_style)],
    ]
    meta_table = Table(meta_data, colWidths=[1.5*inch, 5.0*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 25))

    # Course Overview Callout
    overview_text = (
        "<b>Executive Summary & Curriculum Goal:</b><br/>"
        "Biashara ERP is a modern, enterprise-grade cloud ERP platform built specifically for fast-growing businesses. "
        "This curriculum provides an exhaustive walkthrough of every single screen, module, workflow, and financial control "
        "embedded in the application. Learners and system operators will gain complete mastery over sales pipelines, multi-warehouse "
        "inventory, quote-to-cash operations, procure-to-pay automation, statutory Kenyan payroll, double-entry general ledger, "
        "KRA VAT tax compliance, and super-admin multi-tenant controls."
    )
    overview_table = Table([[Paragraph(overview_text, callout_style)]], colWidths=[6.5*inch])
    overview_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")), # Light Blue
        ('PADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#93C5FD")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 25))

    # Table of Contents Outline
    story.append(Paragraph("Curriculum Table of Contents", h2_style))
    toc_data = [
        [Paragraph("<b>Module 1:</b> Foundation, Security & Onboarding", table_cell_style), Paragraph("<b>Module 6:</b> Kenyan Payroll & HR Engine", table_cell_style)],
        [Paragraph("<b>Module 2:</b> CRM, Contacts & Sales Pipeline", table_cell_style), Paragraph("<b>Module 7:</b> General Ledger, Assets & Controls", table_cell_style)],
        [Paragraph("<b>Module 3:</b> Product Catalog & Warehouse Inventory", table_cell_style), Paragraph("<b>Module 8:</b> Financial Intelligence, Tax & Reports", table_cell_style)],
        [Paragraph("<b>Module 4:</b> Sales Operations & Invoicing (Q2C)", table_cell_style), Paragraph("<b>Module 9:</b> Client Portal & Self-Service", table_cell_style)],
        [Paragraph("<b>Module 5:</b> Procurement, Expenses & Payables (P2P)", table_cell_style), Paragraph("<b>Module 10:</b> Super Admin & Multi-Tenancy", table_cell_style)],
    ]
    toc_table = Table(toc_data, colWidths=[3.25*inch, 3.25*inch])
    toc_table.setStyle(TableStyle([
        ('PADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#F1F5F9")),
    ]))
    story.append(toc_table)

    story.append(PageBreak())

    # -------------------------------------------------------------------------
    # MODULE DATA DEFINITION
    # -------------------------------------------------------------------------
    modules = [
        {
            "num": 1,
            "title": "MODULE 1: Foundation, System Architecture & Business Onboarding",
            "desc": "Establishes core system architecture, authentication workflows, multi-tenant organization context, and initial business onboarding configuration.",
            "learning_objectives": [
                "Understand user authentication and session security protocols.",
                "Configure business profiles, base currency (KES), KRA PINs, and brand styling.",
                "Navigate the primary global dashboard shell, navigation menu, and search shortcuts."
            ],
            "screens": [
                ("/login & /signup", "Authentication Portal", "Secure user registration, password authentication, and session cookie initialization."),
                ("/forgot-password & /update-password", "Account Recovery", "Self-service password recovery flow via email token validation."),
                ("/onboarding", "Organization Setup Wizard", "Initial business configuration: Organization Name, KRA PIN, Currency (KES), Fiscal Year, and Brand Colors."),
                ("(app)/layout.tsx Shell", "Global Desktop & Mobile Shell", "Primary application interface: Sidebar Navigation, Global Search (Cmd+K), Notification Bell, and Impersonation Banner.")
            ],
            "workflow": "User Registration → Security Verification → Organization Provisioning → Global Workspace Access."
        },
        {
            "num": 2,
            "title": "MODULE 2: Customer Relationship Management (CRM) & Sales Pipeline",
            "desc": "Manages customer and vendor directories, contact credit limits, customer statements, and visual Kanban sales pipelines.",
            "learning_objectives": [
                "Master contact creation with proper tax classification (Customer vs. Vendor).",
                "Generate custom customer account statements for debt collection.",
                "Track high-value deal opportunities using visual Kanban stages."
            ],
            "screens": [
                ("/contacts", "Contacts Master Directory", "Searchable, filterable list of all customers and vendors with active balance metrics."),
                ("/contacts/new", "Contact Registration Form", "Detailed contact entry: KRA PIN, Email, Phone, Payment Terms, Bank Details, and Billing/Shipping Addresses."),
                ("/contacts/[id]", "Contact Profile & History", "Comprehensive 360-degree contact view displaying open invoices, payments, quotes, and activity timeline."),
                ("/contacts/[id]/statement", "Customer Statement Generator", "Custom date-range statement generator exporting PDF account balances for customer reconciliation."),
                ("/pipeline", "Kanban Sales Pipeline", "Interactive drag-and-drop CRM deal board tracking opportunity stages, deal values, and closing dates.")
            ],
            "workflow": "Lead Generation → Opportunity Tracking (Pipeline) → Contact Profiling → Credit Limit Assignment."
        },
        {
            "num": 3,
            "title": "MODULE 3: Product Catalog, Multi-Warehouse & Stock Transfers",
            "desc": "Oversees physical goods and service items, multi-location warehouse management, inventory reorder points, and stock movement logs.",
            "learning_objectives": [
                "Distinguish between physical Inventory Goods and intangible Services.",
                "Configure multiple warehouse locations with custom bin IDs and stock levels.",
                "Execute inter-warehouse stock transfer orders with audit trail verification."
            ],
            "screens": [
                ("/items", "Items & Services Directory", "Master list of products and services, stock on hand, purchase costs, and sales prices."),
                ("/items/new", "Item Creation Form", "Configures SKU, Item Name, Type (Goods/Service), Unit Price, Purchase Price, Income GL, Expense GL, and Initial Stock."),
                ("/items/warehouses", "Warehouse Directory", "List of all physical storage locations, distribution centers, and storage capacity metrics."),
                ("/items/warehouses/[id]", "Warehouse Detail & Bin Inspection", "Warehouse-specific stock inventory list, bin numbers, and localized valuation."),
                ("/items/transfers", "Stock Transfer Management", "Creates and tracks stock movement between warehouses, updating localized inventory balances in real time.")
            ],
            "workflow": "Item Definition → Stock Intake / Receiving → Multi-Warehouse Allocation → Stock Transfer Order Execution."
        },
        {
            "num": 4,
            "title": "MODULE 4: Sales Operations, Invoicing & Revenue Management (Q2C)",
            "desc": "Covers the end-to-end Quote-to-Cash (Q2C) lifecycle, customized document templates, M-Pesa payment recording, credit notes, and recurring retainers.",
            "learning_objectives": [
                "Draft professional sales quotes and convert them seamlessly to binding invoices.",
                "Apply accurate Kenyan VAT tax classes (B16 Standard 16%, Exempt, Zero-Rated).",
                "Log manual customer payments (M-Pesa, Wire, Cash) and issue credit notes for returns."
            ],
            "screens": [
                ("/sales/quotes", "Quotations Directory", "Status tracker for draft, sent, accepted, and declined customer quotes."),
                ("/sales/quotes/new & /[id]/edit", "Quote Builder", "Drafts estimates with line items, quantity, discounts, tax selection (B16), and custom terms."),
                ("/sales/quote-templates", "Quote PDF Customizer", "Designs visual PDF quotation templates with custom headers, colors, and legal disclaimers."),
                ("/sales/invoices", "Invoices Master Hub", "Comprehensive invoice list with status indicators (Paid, Overdue, Partial, Draft)."),
                ("/sales/invoices/new & /[id]", "Invoice Engine & View", "Generates tax invoices, converts from quotes, prints formatted PDFs, and sends client links."),
                ("/sales/invoice-templates", "Invoice Branding Studio", "Customizes tax invoice branding, payment instructions, bank details, and footer text."),
                ("/sales/payments", "Payment Settlement Directory", "Logs customer payments against outstanding invoices, updating invoice status to Paid."),
                ("/sales/payments/events", "Gateway Event Log", "Audit log of automated payment gateway webhooks (M-Pesa Express, KopoKopo, Card settlements)."),
                ("/sales/credit-notes", "Credit Notes Directory", "Manages customer returns, sales adjustments, and credit note issuance against invoices."),
                ("/recurring", "Recurring Billing Schedules", "Automates monthly/quarterly subscription invoicing schedules and retainer billing.")
            ],
            "workflow": "Quotation Issued → Customer Approval → Invoice Generation → Payment Receipt (M-Pesa/Bank) → Ledger Posting."
        },
        {
            "num": 5,
            "title": "MODULE 5: Procurement, Vendor Bills & Accounts Payable (P2P)",
            "desc": "Manages Purchase Orders, vendor bills, operational expenses, employee reimbursable claims, and automated bulk payment runs.",
            "learning_objectives": [
                "Issue official Purchase Orders to suppliers and track delivery status.",
                "Record vendor bills with input VAT tax credit claims.",
                "Process employee expense claims and execute automated bulk payment runs."
            ],
            "screens": [
                ("/purchases/orders", "Purchase Orders Directory", "Tracking supplier POs, approval statuses, and fulfillment progress."),
                ("/purchases/orders/new", "PO Builder", "Drafts purchase orders with vendor line items, expected delivery dates, and delivery addresses."),
                ("/purchases/bills", "Vendor Bills Directory", "Accounts payable hub tracking supplier bills, due dates, and unpaid liability balances."),
                ("/purchases/bills/new & /[id]", "Bill Entry & Detail View", "Logs vendor bills, claims input VAT credits, attaches receipt attachments, and approves bills."),
                ("/purchases/expenses", "Expenses Directory", "Tracks operational cash expenses (Fuel, Rent, Utilities, Office Supplies)."),
                ("/purchases/expenses/new", "Expense Entry Form", "Logs direct expense payouts with GL account assignment, tax inclusion, and payment method."),
                ("/expense-claims", "Employee Expense Claims", "Portal for staff to submit out-of-pocket expense claims for manager review and reimbursement."),
                ("/purchases/payment-runs", "Automated Payment Runs", "Batch processing tool to select approved bills/expenses and execute bulk payouts.")
            ],
            "workflow": "PO Creation → Vendor Delivery → Bill Logging (Input VAT) → Manager Approval → Bulk Payment Run Settlement."
        },
        {
            "num": 6,
            "title": "MODULE 6: Kenyan Payroll Engine, Statutory Compliance & HR",
            "desc": "Implements full Kenyan statutory compliance (KRA PAYE tiers, SHIF, NHIF, NSSF, Housing Levy), staff loans, timesheets, and monthly payslips.",
            "learning_objectives": [
                "Maintain complete employee profiles with statutory KRA, NSSF, and SHIF numbers.",
                "Configure statutory tax brackets, personal relief (KES 2,400/mo), and insurance relief.",
                "Execute monthly payroll runs, amortize staff loans, and export itemized payslips."
            ],
            "screens": [
                ("/payroll/employees", "Employee Directory", "Master roster of active, on-leave, and terminated staff members."),
                ("/payroll/employees/new & /[id]", "Employee Profile & Pay Terms", "Configures basic salary, housing allowance, transport allowance, KRA PIN, NSSF ID, and SHIF ID."),
                ("/payroll/rules", "Statutory Rule Engine", "Defines tax formula parameters: PAYE bands, SHIF (2.75%), NSSF Tiers I & II, Housing Levy (1.5%)."),
                ("/payroll/loans", "Staff Loans & Advances Hub", "Tracks company loans granted to employees, interest rates, and automated monthly repayment schedules."),
                ("/payroll/runs", "Payroll History & Run Launcher", "Directory of past payroll runs and launcher for initiating new monthly payroll cycles."),
                ("/payroll/runs/[id]", "Payroll Execution & Payslip Studio", "Computes gross-to-net salary breakdown, deductions, generates payslips, and posts payroll to GL."),
                ("/time-tracking", "Timesheets & Attendance Log", "Tracks hourly work logs, project time allocation, and billable employee hours.")
            ],
            "workflow": "Employee Seeding → Time Tracking / Loan Deductions → Payroll Engine Execution → Payslip Distribution → KRA/SHIF Remittance."
        },
        {
            "num": 7,
            "title": "MODULE 7: General Ledger, Asset Register & Financial Controls",
            "desc": "Enforces double-entry financial accounting, chart of accounts customization, manual journals, cost centers, fixed assets, and period locking.",
            "learning_objectives": [
                "Navigate the Chart of Accounts structure (Assets, Liabilities, Equity, Revenue, Expense).",
                "Post balanced manual journal entries for accruals and reclassifications.",
                "Manage Fixed Asset depreciation schedules and enforce accounting period locks."
            ],
            "screens": [
                ("/accountant", "Chart of Accounts (CoA) Master", "Hierarchical structure of all financial accounts, account codes, and live balance metrics."),
                ("/accountant/ledger/[id]", "General Ledger Account Detail", "Itemized debit and credit transaction history for any specific account code."),
                ("/accountant/journals", "Manual Journals Directory", "Audit log of all manual accounting journal entries and reclassifications."),
                ("/accountant/journals/new", "Journal Entry Builder", "Drafts multi-line debit/credit journal entries with mandatory zero-variance balancing check."),
                ("/accountant/cost-centers", "Cost Centers & Departments", "Defines cost centers for departmental, regional, or project-based profitability tracking."),
                ("/accounting/assets", "Fixed Asset Register", "Directory of company assets (Vehicles, Machinery, IT Equipment) with cost basis and book value."),
                ("/accounting/assets/new", "Asset Acquisition & Depreciation", "Registers new asset, selects depreciation method (Straight Line / Reducing Balance), and sets useful life."),
                ("/accounting/budgets", "Annual Budget Manager", "Creates financial budgets per account and tracks month-by-month actual vs. budget variance."),
                ("/accounting/drawings", "Owner Drawings & Equity", "Logs equity withdrawals, capital injections, and partner dividend distributions."),
                ("/accounting/period-lock", "Financial Period Lock Screen", "Locks past accounting periods to prevent unauthorized editing of audited financial records."),
                ("/banking", "Bank Accounts & Reconciliation", "Monitors bank account balances, imports bank statements, and performs statement reconciliation.")
            ],
            "workflow": "Transaction Capture → Automated GL Posting → Manual Journal Adjustment → Period Lock Safeguard."
        },
        {
            "num": 8,
            "title": "MODULE 8: Financial Intelligence, Analytics & Tax Reporting",
            "desc": "Provides executive analytics, formal financial statements (P&L, Balance Sheet, Cash Flow), aging reports, and KRA VAT return filings.",
            "learning_objectives": [
                "Interpret Executive Analytics dashboards for business performance evaluation.",
                "Generate core financial statements (Profit & Loss, Balance Sheet, Cash Flow).",
                "Audit books health and export KRA-compliant VAT return filings (Output VAT vs Input VAT)."
            ],
            "screens": [
                ("/analytics", "Executive KPI Dashboard", "Real-time visual charts: Revenue growth, gross margin ratios, top clients, and cash runway."),
                ("/reports", "Master Reports Hub", "Centralized launcher for all operational, financial, tax, and sales performance reports."),
                ("/reports/pnl", "Profit & Loss (P&L) Statement", "Calculates net income by summarizing operating revenue, cost of goods sold (COGS), and expenses."),
                ("/reports/balance-sheet", "Balance Sheet Statement", "Snapshot of organization solvency: Total Assets = Total Liabilities + Equity."),
                ("/reports/cash-flow", "Cash Flow Statement", "Tracks cash inflows and outflows across Operating, Investing, and Financing activities."),
                ("/reports/trial-balance", "Trial Balance & Books Health", "Audit tool verifying that total debit balances equal total credit balances across all GL accounts."),
                ("/reports/vat & /vat3", "KRA VAT Tax Return Generator", "Computes Output VAT charged on sales minus Input VAT paid on purchases for monthly KRA filing."),
                ("/reports/aging", "Accounts Receivable & Payable Aging", "Categorizes outstanding debts into 0-30, 31-60, 61-90, and 90+ day overdue buckets."),
                ("/reports/sales/*", "Detailed Sales Analytics", "Granular reports: Sales by Customer, Sales by Item, Quote Conversion Rate, and Credit Note Summary.")
            ],
            "workflow": "Operational Data Collection → Trial Balance Verification → Financial Statement Generation → Tax Filing (KRA VAT)."
        },
        {
            "num": 9,
            "title": "MODULE 9: Client Portal & Customer Self-Service",
            "desc": "Enables customers to securely log in, view account statements, download invoices, track CRM deals, and access support documentation.",
            "learning_objectives": [
                "Configure and brand the customer self-service portal.",
                "Allow clients to review, accept estimates, and pay invoices online.",
                "Publish user guides and FAQs in the integrated Knowledge Base."
            ],
            "screens": [
                ("/portal/[orgSlug]/login", "Client Portal Authentication", "Secure branded login interface for external clients and customers."),
                ("/portal/[orgSlug]/(dashboard)/dashboard", "Customer Portal Dashboard", "Summary screen for clients displaying outstanding balance, total billed, and recent invoices."),
                ("/portal/[orgSlug]/(dashboard)/documents", "Customer Document Center", "Client repository to view, print, and download PDF quotes, tax invoices, and payment receipts."),
                ("/portal/[orgSlug]/(dashboard)/deals", "Client Project Tracker", "Allows clients to view ongoing project milestones, deal stages, and deliverable timelines."),
                ("/settings/knowledge-base", "Knowledge Base Studio", "Admin editor to create, edit, and publish client help articles, guides, and FAQs."),
                ("/portal/[orgSlug]/(dashboard)/knowledge", "Client Support Hub", "Public-facing searchable help desk for customers to read documentation and FAQs.")
            ],
            "workflow": "Portal Provisioning → Client Account Activation → Online Document Access → Interactive Quote Acceptance."
        },
        {
            "num": 10,
            "title": "MODULE 10: System Administration, Security & Multi-Tenancy",
            "desc": "Empowers system administrators to manage global organization settings, payment gateways, subscription plans, super-admin security, and audit logs.",
            "learning_objectives": [
                "Configure M-Pesa Paybill/Till, KopoKopo, and SMS gateway credentials.",
                "Manage multi-tenant subscriptions, plan upgrades, and feature overrides.",
                "Utilize Super Admin Impersonation for debugging and review system audit trails."
            ],
            "screens": [
                ("/settings", "General Organization Settings", "Updates organization legal name, tax registration number, logo, time zone, and default terms."),
                ("/settings/payments", "Payment Gateway Configuration", "Integrates M-Pesa Express, Paybill, Till Numbers, KopoKopo, and Credit Card processing keys."),
                ("/settings/sms", "SMS Gateway Settings", "Configures SMS gateway credentials (e.g. Africa's Talking) for automated invoice/payment SMS notifications."),
                ("/settings/billing", "Subscription & Plan Management", "Displays current subscription tier (Free, Standard, Business), renewal dates, and usage limits."),
                ("/admin", "Super Admin Control Center", "Master dashboard for platform owners displaying total organizations, MRR revenue, and system health."),
                ("/admin/orgs & /admin/orgs/[id]", "Organization Directory & Impersonation", "List of all tenant organizations with 'Impersonate' trigger for remote administrative support."),
                ("/admin/subscriptions & /revenue", "Subscription Revenue & MRR", "Tracks platform monthly recurring revenue (MRR), subscription renewals, and payment history."),
                ("/admin/audit", "Security Audit Log", "Tamper-evident log tracking super-admin actions: impersonations, plan overrides, and admin management."),
                ("/admin/health & /cron", "System Diagnostics & Cron Monitor", "Monitors database connection pools, background cron jobs, automated billing cycles, and system uptime."),
                ("/admin/announcements", "Platform Announcements Studio", "Publishes platform-wide notification banners visible to all logged-in organization users.")
            ],
            "workflow": "System Configuration → Gateway Integration → Subscription Monitoring → Audit Trail Review."
        }
    ]

    for mod in modules:
        story.append(Paragraph(f"{mod['title']}", h1_style))
        story.append(Paragraph(mod['desc'], body_style))
        story.append(Spacer(1, 4))

        # Learning Objectives
        story.append(Paragraph("<b>Key Learning Objectives:</b>", h2_style))
        for obj in mod['learning_objectives']:
            story.append(Paragraph(f"• {obj}", bullet_style))
        story.append(Spacer(1, 6))

        # Screen-by-Screen Table
        story.append(Paragraph("<b>Screen-by-Screen Functional Map:</b>", h2_style))
        table_data = [[
            Paragraph("Route / Path", table_header_style),
            Paragraph("Screen Name", table_header_style),
            Paragraph("Key Features & Operating Responsibilities", table_header_style)
        ]]

        for route, sname, desc in mod['screens']:
            table_data.append([
                Paragraph(f"<code>{route}</code>", table_cell_bold),
                Paragraph(sname, table_cell_bold),
                Paragraph(desc, table_cell_style)
            ])

        screen_table = Table(table_data, colWidths=[1.8*inch, 1.7*inch, 3.0*inch])
        screen_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('PADDING', (0,0), (-1,-1), 5),
            ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG])
        ]))
        story.append(screen_table)
        story.append(Spacer(1, 8))

        # Core Workflow Callout
        wf_box = Table([[Paragraph(f"<b>Core Operating Workflow:</b> {mod['workflow']}", callout_style)]], colWidths=[6.5*inch])
        wf_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")), # Light Green
            ('PADDING', (0,0), (-1,-1), 8),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#86EFAC")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(wf_box)
        story.append(Spacer(1, 14))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated PDF: {pdf_path}")

if __name__ == "__main__":
    build_pdf()
