/**
 * Kenyan seed Chart of Accounts. Codes are stable — the posting engine
 * references accounts by these codes (system accounts cannot be deleted).
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
  COGS: "5000",
  INVENTORY_ADJ: "5100",
  OPENING_BALANCE: "3900",
  RETAINED: "3200",
  OWNER_EQUITY: "3000",
  BANK_DEFAULT: "1000",
  MPESA: "1010",
  CASH: "1020",
} as const;

type AccountSeed = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  subtype: string;
  system?: boolean;
};

export const SEED_ACCOUNTS: AccountSeed[] = [
  // Assets
  { code: "1000", name: "Bank Account", type: "asset", subtype: "bank", system: true },
  { code: "1010", name: "M-Pesa", type: "asset", subtype: "bank", system: true },
  { code: "1020", name: "Petty Cash", type: "asset", subtype: "cash", system: true },
  { code: "1050", name: "Undeposited Funds", type: "asset", subtype: "other_current_asset", system: true },
  { code: "1200", name: "Accounts Receivable", type: "asset", subtype: "accounts_receivable", system: true },
  { code: "1300", name: "VAT Input (Claimable)", type: "asset", subtype: "other_current_asset", system: true },
  { code: "1310", name: "Withholding Tax Receivable", type: "asset", subtype: "other_current_asset", system: true },
  { code: "1400", name: "Inventory Asset", type: "asset", subtype: "stock", system: true },
  { code: "1500", name: "Furniture & Equipment", type: "asset", subtype: "fixed_asset" },
  { code: "1510", name: "Computers & Software", type: "asset", subtype: "fixed_asset" },
  // Liabilities
  { code: "2100", name: "Accounts Payable", type: "liability", subtype: "accounts_payable", system: true },
  { code: "2200", name: "VAT Output (Payable to KRA)", type: "liability", subtype: "current_liability", system: true },
  { code: "2300", name: "PAYE Payable", type: "liability", subtype: "current_liability" },
  { code: "2310", name: "SHIF Payable", type: "liability", subtype: "current_liability" },
  { code: "2320", name: "NSSF Payable", type: "liability", subtype: "current_liability" },
  { code: "2400", name: "Loans Payable", type: "liability", subtype: "long_term_liability" },
  // Equity
  { code: "3000", name: "Owner's Equity", type: "equity", subtype: "equity", system: true },
  { code: "3100", name: "Owner Drawings", type: "equity", subtype: "equity" },
  { code: "3200", name: "Retained Earnings", type: "equity", subtype: "equity", system: true },
  { code: "3900", name: "Opening Balance Adjustments", type: "equity", subtype: "equity", system: true },
  // Income
  { code: "4000", name: "Sales", type: "income", subtype: "income", system: true },
  { code: "4100", name: "Other Income", type: "income", subtype: "income", system: true },
  { code: "4200", name: "Shipping & Delivery Income", type: "income", subtype: "income" },
  // Expenses
  { code: "5000", name: "Cost of Goods Sold", type: "expense", subtype: "cost_of_goods_sold", system: true },
  { code: "5100", name: "Inventory Adjustments", type: "expense", subtype: "cost_of_goods_sold", system: true },
  { code: "6000", name: "Rent", type: "expense", subtype: "expense" },
  { code: "6010", name: "Electricity & Water", type: "expense", subtype: "expense" },
  { code: "6020", name: "Internet & Airtime", type: "expense", subtype: "expense" },
  { code: "6030", name: "Salaries & Wages", type: "expense", subtype: "expense" },
  { code: "6040", name: "Transport & Fuel", type: "expense", subtype: "expense" },
  { code: "6050", name: "Marketing & Advertising", type: "expense", subtype: "expense" },
  { code: "6060", name: "Professional Fees", type: "expense", subtype: "expense" },
  { code: "6070", name: "Bank & M-Pesa Charges", type: "expense", subtype: "expense" },
  { code: "6080", name: "Licenses & County Fees", type: "expense", subtype: "expense" },
  { code: "6090", name: "Office Supplies", type: "expense", subtype: "expense" },
  { code: "6100", name: "Repairs & Maintenance", type: "expense", subtype: "expense" },
  { code: "6110", name: "Insurance", type: "expense", subtype: "expense" },
  { code: "6900", name: "Miscellaneous Expenses", type: "expense", subtype: "expense" },
];
