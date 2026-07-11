/**
 * Kenyan Payroll Rules Engine
 * Amounts are handled in KES CENTS to avoid floating point issues.
 */

export interface RuleDef {
  id: number;
  type: string; // PAYE, SHIF, NSSF, AHL, RELIEF
  calculationType: string; // banded, flat_percent, capped, flat_amount
  parametersJson: string;
}

export interface PayrollInput {
  employeeId: number;
  basicSalaryCents: number;
  unpaidLeaveDays: number;
  workingDaysInMonth: number;
  adjustments: { amountCents: number; isTaxable: boolean; isDeduction: boolean; reason: string }[];
  loanInstallments: { amountCents: number; loanId: number }[];
}

export interface LineItem {
  type: "gross_pay" | "deduction" | "addition" | "net_pay";
  subType: string;
  amountCents: number;
  isDeduction: boolean;
  statutoryRuleId?: number;
}

export function runPayrollEngine(input: PayrollInput, rules: RuleDef[]): LineItem[] {
  const lines: LineItem[] = [];

  // 1. Calculate Gross Pay
  let grossCents = input.basicSalaryCents;
  if (input.unpaidLeaveDays > 0 && input.workingDaysInMonth > 0) {
    const dailyRate = Math.floor(input.basicSalaryCents / input.workingDaysInMonth);
    grossCents = input.basicSalaryCents - (dailyRate * input.unpaidLeaveDays);
  }

  // 2. Adjustments
  let taxableAdjustments = 0;
  let nonTaxableAdjustments = 0;

  for (const adj of input.adjustments) {
    if (adj.isDeduction) {
      if (adj.isTaxable) taxableAdjustments -= adj.amountCents;
      else nonTaxableAdjustments -= adj.amountCents;
    } else {
      if (adj.isTaxable) taxableAdjustments += adj.amountCents;
      else nonTaxableAdjustments += adj.amountCents;
    }
    lines.push({
      type: adj.isDeduction ? "deduction" : "addition",
      subType: "adjustment",
      amountCents: adj.amountCents,
      isDeduction: adj.isDeduction
    });
  }

  grossCents = Math.max(0, grossCents + taxableAdjustments + nonTaxableAdjustments);
  
  lines.push({
    type: "gross_pay",
    subType: "basic",
    amountCents: grossCents,
    isDeduction: false
  });

  const taxableIncomeBase = grossCents - nonTaxableAdjustments; // non-taxable adjustments don't count for PAYE

  // Helper to get rule
  const getRule = (type: string) => rules.find(r => r.type === type);

  // 3. NSSF (Pre-tax)
  let nssfCents = 0;
  const nssfRule = getRule("NSSF");
  if (nssfRule) {
    const params = JSON.parse(nssfRule.parametersJson);
    if (nssfRule.calculationType === "capped") {
      nssfCents = Math.round(grossCents * params.rate);
      if (nssfCents > params.capCents) nssfCents = params.capCents;
    } else if (nssfRule.calculationType === "flat_percent") {
      nssfCents = Math.round(grossCents * params.rate);
    }
    lines.push({
      type: "deduction",
      subType: "NSSF",
      amountCents: nssfCents,
      isDeduction: true,
      statutoryRuleId: nssfRule.id
    });
  }

  // 4. AHL (Pre-tax)
  let ahlCents = 0;
  const ahlRule = getRule("AHL");
  if (ahlRule) {
    const params = JSON.parse(ahlRule.parametersJson);
    ahlCents = Math.round(grossCents * params.rate);
    lines.push({
      type: "deduction",
      subType: "AHL",
      amountCents: ahlCents,
      isDeduction: true,
      statutoryRuleId: ahlRule.id
    });
  }

  // 5. Taxable Pay
  const taxablePay = Math.max(0, taxableIncomeBase - nssfCents - ahlCents);

  // 6. PAYE
  let payeCents = 0;
  const payeRule = getRule("PAYE");
  if (payeRule) {
    const params = JSON.parse(payeRule.parametersJson);
    let remaining = taxablePay;
    let tax = 0;
    for (const band of params.bands) {
      if (remaining <= 0) break;
      const amountInBand = band.upToCents ? Math.min(remaining, band.upToCents) : remaining;
      tax += Math.round(amountInBand * band.rate);
      remaining -= amountInBand;
    }

    const reliefRule = getRule("RELIEF");
    let relief = 0;
    let reliefRuleId = undefined;
    if (reliefRule) {
      relief = JSON.parse(reliefRule.parametersJson).amountCents;
      reliefRuleId = reliefRule.id;
    }

    payeCents = Math.max(0, tax - relief);
    lines.push({
      type: "deduction",
      subType: "PAYE",
      amountCents: payeCents,
      isDeduction: true,
      statutoryRuleId: payeRule.id
    });
  }

  // 7. SHIF (Post-tax)
  let shifCents = 0;
  const shifRule = getRule("SHIF");
  if (shifRule) {
    const params = JSON.parse(shifRule.parametersJson);
    shifCents = Math.round(grossCents * params.rate);
    lines.push({
      type: "deduction",
      subType: "SHIF",
      amountCents: shifCents,
      isDeduction: true,
      statutoryRuleId: shifRule.id
    });
  }

  // 8. Voluntary Deductions (Loans)
  let loanDeductions = 0;
  for (const loan of input.loanInstallments) {
    loanDeductions += loan.amountCents;
    lines.push({
      type: "deduction",
      subType: "loan",
      amountCents: loan.amountCents,
      isDeduction: true
    });
  }

  // 9. Net Pay
  const totalDeductions = nssfCents + ahlCents + payeCents + shifCents + loanDeductions;
  const netPayCents = Math.max(0, grossCents - totalDeductions);

  lines.push({
    type: "net_pay",
    subType: "net",
    amountCents: netPayCents,
    isDeduction: false
  });

  return lines;
}
