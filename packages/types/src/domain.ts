export type PaymentLinkStatus = "pending" | "paid" | "expired";

export type PayoutStatus = "requested" | "processing" | "completed" | "failed";

export const DEFAULT_CURRENCY = "USDC" as const;