export const PLANS = {
  free: {
    name: "Free",
    priceCents: 0,
    invoices: 10,
    staff: 1,
    gateways: false,
    sms: 0,
    payouts: false,
    portal: false,
  },
  standard: {
    name: "Standard",
    priceCents: 150000, // KES 1,500
    invoices: -1, // unlimited
    staff: 3,
    gateways: true,
    sms: 100,
    payouts: false,
    portal: false,
  },
  business: {
    name: "Business",
    priceCents: 350000, // KES 3,500
    invoices: -1,
    staff: 10,
    gateways: true,
    sms: 500,
    payouts: true,
    portal: true,
  }
} as const;

export type PlanKey = keyof typeof PLANS;

export interface Entitlements {
  plan: PlanKey;
  isReadOnly: boolean;
  limits: typeof PLANS[PlanKey];
  paidUntil: string;
}


