/**
 * Kenyan Payroll Tax Formulas (2024 rules)
 * Amounts are handled in KES CENTS to avoid floating point issues.
 */

export interface PayslipData {
  grossPayCents: number;
  nssfCents: number;
  shifCents: number;
  housingLevyCents: number;
  payeCents: number;
  netPayCents: number;
}

export function calculatePayroll(basicSalaryCents: number): PayslipData {
  const gross = basicSalaryCents;
  
  // NSSF (Tier I + II max is 2160 KES = 216,000 cents)
  // 6% of gross up to 36,000 KES (3,600,000 cents)
  let nssf = Math.round(gross * 0.06);
  if (nssf > 216000) nssf = 216000;

  // SHIF (2.75% of Gross)
  const shif = Math.round(gross * 0.0275);

  // Housing Levy (1.5% of Gross)
  const housingLevy = Math.round(gross * 0.015);

  // PAYE
  const taxablePay = gross - nssf;
  
  let tax = 0;
  let remaining = taxablePay;

  // Band 1: Up to 24,000 (10%)
  if (remaining > 0) {
    const amount = Math.min(remaining, 2400000);
    tax += Math.round(amount * 0.10);
    remaining -= amount;
  }

  // Band 2: 24,001 to 32,333 (25%) -> band size 8,333 (833,300 cents)
  if (remaining > 0) {
    const amount = Math.min(remaining, 833300);
    tax += Math.round(amount * 0.25);
    remaining -= amount;
  }

  // Band 3: 32,334 to 500,000 (30%) -> band size 467,667 (46,766,700 cents)
  if (remaining > 0) {
    const amount = Math.min(remaining, 46766700);
    tax += Math.round(amount * 0.30);
    remaining -= amount;
  }

  // Band 4: 500,001 to 800,000 (32.5%) -> band size 300,000 (30,000,000 cents)
  if (remaining > 0) {
    const amount = Math.min(remaining, 30000000);
    tax += Math.round(amount * 0.325);
    remaining -= amount;
  }

  // Band 5: Above 800,000 (35%)
  if (remaining > 0) {
    tax += Math.round(remaining * 0.35);
  }

  // Personal Relief (2,400 KES = 240,000 cents)
  const relief = 240000;
  let paye = tax - relief;
  if (paye < 0) paye = 0;

  const netPayCents = gross - shif - nssf - housingLevy - paye;

  return {
    grossPayCents: gross,
    nssfCents: nssf,
    shifCents: shif,
    housingLevyCents: housingLevy,
    payeCents: paye,
    netPayCents: netPayCents,
  };
}
