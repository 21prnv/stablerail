import crypto from "crypto";

const SIGNATURE_HEADER = "x-webhook-signature";
const DELIVERY_HEADER = "x-webhook-id";
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export type WebhookEvent =
  | { type: "payment.completed"; data: { paymentLinkId: string; amount: string; currency: string; status: string } }
  | { type: "payout.completed"; data: { payoutId: string; amount: string; status: string } };

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify webhook signature (for merchant use).
 * Expects header: x-webhook-signature: sha256=<hex>
 */
export function verifyWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const expected = "sha256=" + signPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signatureHeader, "utf8"), Buffer.from(expected, "utf8"));
}

async function deliver(url: string, payload: string, signature: string, webhookId: string): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SIGNATURE_HEADER]: `sha256=${signature}`,
      [DELIVERY_HEADER]: webhookId,
    },
    body: payload,
  });
  return res.ok;
}

/**
 * Send webhook with HMAC-SHA256 signature and retries (exponential backoff).
 * Runs in background; does not throw.
 */
export function sendWebhook(
  webhookUrl: string,
  event: WebhookEvent,
  secret: string
): void {
  const webhookId = crypto.randomUUID();
  const payload = JSON.stringify({
    id: webhookId,
    type: event.type,
    data: event.data,
    createdAt: new Date().toISOString(),
  });
  const signature = signPayload(payload, secret);

  let delay = INITIAL_DELAY_MS;
  const attempt = async (attemptNumber: number): Promise<void> => {
    try {
      const ok = await deliver(webhookUrl, payload, signature, webhookId);
      if (ok) return;
    } catch (e) {
      console.error("[webhook] delivery failed:", webhookUrl, e);
    }
    if (attemptNumber < MAX_RETRIES) {
      setTimeout(() => attempt(attemptNumber + 1), delay);
      delay *= 2;
    }
  };
  attempt(0);
}
