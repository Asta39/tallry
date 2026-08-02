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
    aiMessagesPerDay: 20,
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
    aiMessagesPerDay: 100,
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
    aiMessagesPerDay: -1, // unlimited
  }
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "active" | "expired";

export function normalizePlan(plan: string | null | undefined): PlanKey {
  return (plan && plan in PLANS ? plan : "free") as PlanKey;
}

export function subscriptionStatusForDate(paidUntil: string, today = new Date().toISOString().slice(0, 10)): SubscriptionStatus {
  return paidUntil < today ? "expired" : "active";
}

export function resolvePlanAccess(
  plan: string | null | undefined,
  paidUntil: string,
  today = new Date().toISOString().slice(0, 10)
) {
  const subscriptionPlan = normalizePlan(plan);
  const status = subscriptionStatusForDate(paidUntil, today);
  const planKey: PlanKey = status === "expired" ? "free" : subscriptionPlan;

  return {
    plan: planKey,
    subscriptionPlan,
    status,
    isReadOnly: status === "expired",
    limits: PLANS[planKey],
    paidUntil,
  };
}

export interface Entitlements {
  plan: PlanKey;
  subscriptionPlan: PlanKey;
  status: SubscriptionStatus;
  isReadOnly: boolean;
  limits: typeof PLANS[PlanKey];
  paidUntil: string;
}



export type ReportingTier = "basic" | "standard" | "advanced";
const TIER_RANK: Record<ReportingTier, number> = { basic: 0, standard: 1, advanced: 2 };

/** True if `have` meets or exceeds `need` on the reporting-tier ladder. */
export function meetsReportingTier(have: ReportingTier, need: ReportingTier): boolean {
  return TIER_RANK[have] >= TIER_RANK[need];
}
