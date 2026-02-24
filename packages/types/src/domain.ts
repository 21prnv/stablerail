/** Payment link status */
export type PaymentLinkStatus = "pending" | "paid" | "expired";

/** Payout status */
export type PayoutStatus = "requested" | "processing" | "completed" | "failed";

/** Default currency for payments */
export const DEFAULT_CURRENCY = "USDC" as const;