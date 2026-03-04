import "dotenv/config";
import { Kafka } from "kafkajs";
import { prisma } from "@repo/database";
import { sendWebhookAndWait } from "../lib/webhook.js";
import type { WebhookEvent } from "@repo/types";

const KAFKA_BOOTSTRAP = process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:9092";
const DOMAIN_EVENT_TOPIC = process.env.KAFKA_DOMAIN_EVENT_TOPIC ?? "neon.public.DomainEvent";
const CONSUMER_GROUP = process.env.KAFKA_WEBHOOK_CONSUMER_GROUP ?? "stablerail-webhook-consumer";

interface DebeziumEnvelope {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  source?: Record<string, unknown>;
  op?: string;
}

interface DomainEventRow {
  id: string;
  merchantId: string;
  eventType: string;
  objectId: string;
  createdAt: string;
}

function parseDomainEvent(value: unknown): DomainEventRow | null {
  const envelope = value as DebeziumEnvelope;
  if (envelope?.op !== "c" || !envelope.after) return null;
  const a = envelope.after as Record<string, unknown>;
  const id = a.id;
  const merchantId = a.merchantId;
  const eventType = a.eventType;
  const objectId = a.objectId;
  const createdAt = a.createdAt;
  if (
    typeof id !== "string" ||
    typeof merchantId !== "string" ||
    typeof eventType !== "string" ||
    typeof objectId !== "string"
  ) {
    return null;
  }
  return {
    id,
    merchantId,
    eventType,
    objectId,
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };
}

async function buildWebhookEvent(
  eventType: string,
  objectId: string
): Promise<WebhookEvent | null> {
  if (eventType === "payout.completed" || eventType === "payout.failed") {
    const payout = await prisma.payout.findUnique({ where: { id: objectId } });
    if (!payout) return null;
    if (eventType === "payout.completed") {
      return {
        type: "payout.completed",
        data: {
          payoutId: payout.id,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
        },
      };
    }
    return {
      type: "payout.failed",
      data: {
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        failureReason: payout.failureReason ?? undefined,
      },
    };
  }
  if (eventType === "payment_link.paid") {
    const link = await prisma.paymentLink.findUnique({ where: { id: objectId } });
    if (!link) return null;
    return {
      type: "payment.completed",
      data: {
        paymentLinkId: link.id,
        amount: link.amount,
        currency: link.currency,
        status: link.status,
      },
    };
  }
  return null;
}

async function run(): Promise<void> {
  const kafka = new Kafka({
    clientId: "stablerail-webhook-consumer",
    brokers: KAFKA_BOOTSTRAP.split(",").map((b) => b.trim()),
  });
  const consumer = kafka.consumer({ groupId: CONSUMER_GROUP });
  await consumer.connect();
  await consumer.subscribe({ topic: DOMAIN_EVENT_TOPIC, fromBeginning: false });

  console.log("[webhook-consumer] Subscribed to", DOMAIN_EVENT_TOPIC, "group", CONSUMER_GROUP);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value?.toString();
      if (!raw) return;
      let value: unknown;
      try {
        value = JSON.parse(raw) as unknown;
      } catch {
        return;
      }
      const row = parseDomainEvent(value);
      if (!row) return;

      const merchant = await prisma.merchant.findUnique({
        where: { id: row.merchantId },
        select: { id: true, webhookUrl: true, webhookSecret: true, apiKey: true },
      });
      if (!merchant?.webhookUrl) return;

      const event = await buildWebhookEvent(row.eventType, row.objectId);
      if (!event) return;

      try {
        const secret = merchant.webhookSecret ?? merchant.apiKey;
        await sendWebhookAndWait(merchant.webhookUrl, event, secret, merchant.id);
      } catch (e) {
        console.error("[webhook-consumer] send failed for", row.id, row.eventType, e);
        throw e;
      }
    },
  });
}

run().catch((e) => {
  console.error("[webhook-consumer] Fatal:", e);
  process.exit(1);
});
