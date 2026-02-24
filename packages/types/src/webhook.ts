/** Webhook event: payment completed */
export type WebhookEventPaymentCompleted = {
  type: "payment.completed";
  data: {
    paymentLinkId: string;
    amount: string;
    currency: string;
    status: string;
  };
};

/** Webhook event: payout completed */
export type WebhookEventPayoutCompleted = {
  type: "payout.completed";
  data: {
    payoutId: string;
    amount: string;
    status: string;
  };
};

/** All webhook event types (matches API webhook engine) */
export type WebhookEvent = WebhookEventPaymentCompleted | WebhookEventPayoutCompleted;

/** Full payload sent to merchant (id + type + data + createdAt) */
export type WebhookPayload = {
  id: string;
  type: WebhookEvent["type"];
  data: WebhookEvent["data"];
  createdAt: string; // ISO
};
