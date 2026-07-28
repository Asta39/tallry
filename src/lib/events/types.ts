export type ZenoEventType =
  | "invoice.created"
  | "invoice.paid"
  | "invoice.overdue"
  | "quote.created"
  | "quote.accepted"
  | "payment.received"
  | "bill.created"
  | "bill.approved"
  | "stock.low";

export interface ZenoEventPayload<T = Record<string, any>> {
  eventId: string;
  eventType: ZenoEventType;
  orgId: number;
  timestamp: string;
  data: T;
}
