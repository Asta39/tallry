/**
 * Kenyan seed Chart of Accounts with comprehensive descriptions.
 * Codes are stable — the posting engine references accounts by these codes
 * (system accounts cannot be deleted).
 */

export const SYS = {
  AR: "1200", // Accounts Receivable (Money you're owed)
  AP: "2100", // Accounts Payable (Money you owe)
  VAT_OUTPUT: "2200",
  VAT_INPUT: "1300",
  WHT_RECEIVABLE: "1310", // WHT deducted by customers (prepaid tax asset)
  INVENTORY: "1400",
  UNDEPOSITED: "1050",
  SALES: "4000",
  OTHER_INCOME: "4100",
  ROUNDING: "4110", // whole-shilling rounding differences from mobile-money settlement
  COGS: "5000",
  INVENTORY_ADJ: "5100",
  PRODUCTION_WASTE: "5200",
  OPENING_BALANCE: "3900",
  RETAINED: "3200",
  OWNER_EQUITY: "3000",
  BANK_DEFAULT: "1000",
  MPESA: "1010",
  CASH: "1020",
} as const;

export type AccountSeed = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  subtype: string;
  description: string;
  system?: boolean;
};

export const SEED_ACCOUNTS: AccountSeed[] = [
  // --- ASSETS (1000 – 1999) ---
  { code: "1000", name: "Bank Account", type: "asset", subtype: "bank", description: "Primary corporate bank account for electronic receipts and supplier disbursements.", system: true },
  { code: "1010", name: "M-Pesa", type: "asset", subtype: "bank", description: "Safaricom M-Pesa Paybill, Till, and C2B mobile money collection account.", system: true },
  { code: "1020", name: "Petty Cash", type: "asset", subtype: "cash", description: "Physical cash held on hand for daily minor operational outlays and change.", system: true },
  { code: "1050", name: "Undeposited Funds", type: "asset", subtype: "other_current_asset", description: "Temporary clearing account holding customer payments prior to bank deposit clearance.", system: true },
  { code: "1200", name: "Accounts Receivable", type: "asset", subtype: "accounts_receivable", description: "Money owed to the business by trade customers for goods or services delivered on credit.", system: true },
  { code: "1300", name: "VAT Input (Claimable)", type: "asset", subtype: "other_current_asset", description: "16% VAT paid on purchase invoices and vendor bills, claimable from KRA against VAT Output.", system: true },
  { code: "1310", name: "Withholding Tax Receivable", type: "asset", subtype: "other_current_asset", description: "Prepaid income tax withheld by appointed customer agents, offset against corporate income tax due to KRA.", system: true },
  { code: "1320", name: "Prepaid Expenses & Deposits", type: "asset", subtype: "other_current_asset", description: "Prepaid rent, utility security deposits, and insurance premiums covering future operational periods." },
  { code: "1400", name: "Inventory Asset", type: "asset", subtype: "stock", description: "Total valuation of saleable merchandise and stock on hand valued under FIFO inventory principles.", system: true },
  { code: "1500", name: "Furniture & Office Equipment", type: "asset", subtype: "fixed_asset", description: "Physical office assets including desks, chairs, storage units, air conditioners, and fixtures." },
  { code: "1510", name: "Computers & IT Hardware", type: "asset", subtype: "fixed_asset", description: "Company laptops, servers, network switches, POS terminals, and permanent software licenses." },
  { code: "1520", name: "Motor Vehicles", type: "asset", subtype: "fixed_asset", description: "Company delivery trucks, vans, motorbikes, and executive transport vehicles." },
  { code: "1530", name: "Accumulated Depreciation", type: "asset", subtype: "fixed_asset", description: "Contra-asset account recording aggregate wear-and-tear depreciation across all fixed assets." },

  // --- LIABILITIES (2000 – 2999) ---
  { code: "2100", name: "Accounts Payable", type: "liability", subtype: "accounts_payable", description: "Short-term debt owed to vendors and trade suppliers for goods/services purchased on credit terms.", system: true },
  { code: "2200", name: "VAT Output (Payable to KRA)", type: "liability", subtype: "current_liability", description: "16% VAT collected from customers on taxable sales, payable to KRA (iTax) by the 20th of every month.", system: true },
  { code: "2300", name: "PAYE Payable", type: "liability", subtype: "current_liability", description: "Pay-As-You-Earn employee tax withheld from monthly payroll, payable to KRA by the 9th of every month." },
  { code: "2310", name: "SHIF Payable", type: "liability", subtype: "current_liability", description: "Social Health Insurance Fund (SHA 2.75%) staff healthcare contributions withheld for remittance." },
  { code: "2320", name: "NSSF Payable", type: "liability", subtype: "current_liability", description: "National Social Security Fund (Tier I & Tier II) mandatory pension deductions awaiting remittance." },
  { code: "2330", name: "Affordable Housing Levy Payable (AHL)", type: "liability", subtype: "current_liability", description: "Mandatory Housing Levy (1.5% employee + 1.5% employer match) payable to KRA." },
  { code: "2340", name: "Staff Reimbursements Payable", type: "liability", subtype: "current_liability", description: "Approved staff expense claims waiting to be disbursed back to employees." },
  { code: "2350", name: "Deferred / Unearned Revenue", type: "liability", subtype: "current_liability", description: "Customer advance deposits received for work or shipments not yet fulfilled." },
  { code: "2360", name: "Accrued Operating Expenses", type: "liability", subtype: "current_liability", description: "Estimated utility, interest, or service obligations incurred but not yet billed at period end." },
  { code: "2370", name: "Director / Owner Loan Account", type: "liability", subtype: "current_liability", description: "Capital injected into business operations by company directors or shareholders." },
  { code: "2400", name: "Loans & Bank Credit Facilities", type: "liability", subtype: "long_term_liability", description: "Long-term bank financing, commercial asset loans, and revolving credit facilities." },

  // --- EQUITY (3000 – 3999) ---
  { code: "3000", name: "Owner's Capital", type: "equity", subtype: "equity", description: "Total initial capital and equity contributions invested in the business by shareholders.", system: true },
  { code: "3100", name: "Owner Drawings", type: "equity", subtype: "equity", description: "Funds or personal funds drawn from business accounts by company owners." },
  { code: "3200", name: "Retained Earnings", type: "equity", subtype: "equity", description: "Cumulative net profit generated by the business retained from prior financial years.", system: true },
  { code: "3900", name: "Opening Balance Adjustments", type: "equity", subtype: "equity", description: "Technical clearing account used to balance historical opening balances during initial setup.", system: true },

  // --- INCOME (4000 – 4999) ---
  { code: "4000", name: "Sales & Operating Income", type: "income", subtype: "income", description: "Primary gross revenue earned from core commercial sales of products and services.", system: true },
  { code: "4100", name: "Other Revenue", type: "income", subtype: "income", description: "Secondary revenue earned from interest on cash deposits, scrap sales, or exchange rate gains.", system: true },
  { code: "4110", name: "Rounding Adjustments", type: "income", subtype: "income", description: "Small differences absorbed when M-Pesa/mobile-money can only move whole shillings against an invoice total that includes cents — keeps customer balances at exactly zero instead of leaving a stray few cents owed either way.", system: true },
  { code: "4200", name: "Shipping & Freight Income", type: "income", subtype: "income", description: "Delivery, logistics, and shipping fees billed directly to customers on sales invoices." },

  // --- EXPENSES & COGS (5000 – 6999) ---
  { code: "5000", name: "Cost of Goods Sold (COGS)", type: "expense", subtype: "cost_of_goods_sold", description: "Direct purchase cost of inventory items sold to customers during the accounting period.", system: true },
  { code: "5100", name: "Inventory Adjustments & Stock Variance", type: "expense", subtype: "inventory_adjustment", description: "Cost of inventory shrinkage, damage, expiration, or stock audit count adjustments — reported separately from COGS since a large found-stock adjustment can swing this to a net credit (a gain), which would otherwise distort the Cost of Goods Sold figure.", system: true },
  { code: "5200", name: "Production Waste", type: "expense", subtype: "other_expense", description: "Cost of unusable offcut/scrap material consumed alongside a Bill of Materials product (e.g. a cut roll's trimmed edge) — tracked separately from Cost of Goods Sold so material waste is visible instead of silently inflating product cost.", system: true },
  { code: "6000", name: "Rent & Premises Lease", type: "expense", subtype: "expense", description: "Lease and rental payments for shopfronts, commercial offices, and warehouses." },
  { code: "6010", name: "Electricity, Water & Utilities", type: "expense", subtype: "expense", description: "KPLC power bills, municipal water, generator fuel, and waste management charges." },
  { code: "6020", name: "Internet, Phone & Airtime", type: "expense", subtype: "expense", description: "Safaricom/Airtel airtime, staff communication allowances, and office high-speed fiber internet." },
  { code: "6030", name: "Salaries & Staff Wages", type: "expense", subtype: "expense", description: "Gross compensation, overtime, and monthly wages paid to regular employees and staff." },
  { code: "6035", name: "Staff Welfare & Meals", type: "expense", subtype: "expense", description: "Office tea, lunches, staff team-building events, first-aid, and employee welfare expenses." },
  { code: "6038", name: "Employer Housing Levy (AHL)", type: "expense", subtype: "expense", description: "Employer matching 1.5% contribution for mandatory Kenya Housing Levy." },
  { code: "6040", name: "Transport & Fuel Expenses", type: "expense", subtype: "expense", description: "Vehicle fuel, Matatu/cab fares, courier deliveries, and local transportation outlays." },
  { code: "6050", name: "Marketing & Advertisements", type: "expense", subtype: "expense", description: "Digital ads (Meta/Google), print branding, billboards, promotional items, and campaigns." },
  { code: "6060", name: "Professional & Consultancy Fees", type: "expense", subtype: "expense", description: "Retainers for legal counsel, external accounting, tax advisors, and management consultants." },
  { code: "6070", name: "Bank & M-Pesa Charges", type: "expense", subtype: "expense", description: "Safaricom B2C/Paybill transaction charges, bank monthly fees, and transfer commissions." },
  { code: "6075", name: "Interest Expense & Finance Charges", type: "expense", subtype: "expense", description: "Interest accrued on bank overdrafts, credit lines, and short-term debt facilities." },
  { code: "6080", name: "Licenses & County Permits", type: "expense", subtype: "expense", description: "County Government Single Business Permit (SBP), NEMA fees, and regulatory licenses." },
  { code: "6090", name: "Office Supplies & Consumables", type: "expense", subtype: "expense", description: "Printing paper, toner cartridges, pens, stationery, and daily office consumables." },
  { code: "6100", name: "Repairs & Equipment Maintenance", type: "expense", subtype: "expense", description: "Routine repairs and servicing for IT hardware, machinery, office fixtures, and vehicles." },
  { code: "6110", name: "Commercial Insurance", type: "expense", subtype: "expense", description: "Insurance premiums covering fire, burglary, goods in transit, and public liability." },
  { code: "6120", name: "Depreciation Expense", type: "expense", subtype: "expense", description: "Non-cash monthly charge recognizing asset wear-and-tear across computers, vehicles, and equipment." },
  { code: "6130", name: "Bad Debts Written Off", type: "expense", subtype: "expense", description: "Uncollectible customer invoices written off from Accounts Receivable to reflect bad debts." },
  { code: "6140", name: "Training & Staff Development", type: "expense", subtype: "expense", description: "Staff training workshops, professional course fees, certifications, and conferences." },
  { code: "6150", name: "Business Travel & Lodging", type: "expense", subtype: "expense", description: "Hotel accommodation, meals, and flight/bus travel costs for out-of-town business trips." },
  { code: "6160", name: "Software & SaaS Subscriptions", type: "expense", subtype: "expense", description: "Monthly software subscriptions, web hosting, domain name renewals, and IT cloud tools." },
  { code: "6170", name: "Printing & Promotional Materials", type: "expense", subtype: "expense", description: "Printing receipt books, branded delivery notes, banners, cards, and company profiles." },
  { code: "6180", name: "Security & Janitorial Services", type: "expense", subtype: "expense", description: "Outsourced premises security guards, alarm monitoring, and professional cleaning services." },
  { code: "6900", name: "Miscellaneous Operational Expenses", type: "expense", subtype: "expense", description: "Minor operational expenses that do not fall cleanly into existing expense categories." },
];
