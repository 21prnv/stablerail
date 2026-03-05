export type WebhookEventPaymentCompleted = {
  type: "payment.completed";
  data: {
    paymentLinkId: string;
    amount: string;
    currency: string;
    status: string;
  };
};

export type WebhookEventPayoutCompleted = {
  type: "payout.completed";
  data: {
    payoutId: string;
    amount: string;
    status: string;
  };
};

export type WebhookEvent = WebhookEventPaymentCompleted | WebhookEventPayoutCompleted;

export type WebhookPayload = {
  id: string;
  type: WebhookEvent["type"];
  data: WebhookEvent["data"];
  createdAt: string;
};
