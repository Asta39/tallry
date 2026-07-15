export const PLANS = {
  free: {
    name: "Free",
    priceCents: 0,
    invoices: 15,
    staff: 1,
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
    priceCents: 150000, // KES 1,500
    invoices: -1, // unlimited
    staff: 3,
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
    priceCents: 350000, // KES 3,500
    invoices: -1,
    staff: 10,
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

export interface Entitlements {
  plan: PlanKey;
  isReadOnly: boolean;
  limits: typeof PLANS[PlanKey];
  paidUntil: string;
}


