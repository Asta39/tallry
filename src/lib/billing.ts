export const PLANS = {
  free: {
    name: "Free",
    monthlyCents: 0,
    annualCents: 0,
    invoices: 15,
    staff: 2,
    gateways: false,
    sms: false,
    payouts: false,
    portal: false,
    recurring: false,
    payroll: false,
    reporting: "basic" as "basic" | "standard" | "advanced",
  },
  standard: {
    name: "Standard",
    monthlyCents: 150000, // KES 1,500
    annualCents: 1440000, // KES 14,400 (20% off)
    invoices: -1, // unlimited
    staff: 5,
    gateways: true,
    sms: true,
    payouts: false,
    portal: false,
    recurring: true,
    payroll: false,
    reporting: "standard" as "basic" | "standard" | "advanced",
  },
  business: {
    name: "Business",
    monthlyCents: 350000, // KES 3,500
    annualCents: 3360000, // KES 33,600 (20% off)
    invoices: -1,
    staff: -1,
    gateways: true,
    sms: true,
    payouts: true,
    portal: true,
    recurring: true,
    payroll: true,
    reporting: "advanced" as "basic" | "standard" | "advanced",
  }
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingCycle = "monthly" | "annual";

export interface Entitlements {
  plan: PlanKey;
  isReadOnly: boolean;
  limits: typeof PLANS[PlanKey];
  paidUntil: string;
}


