# Kafka + Debezium for webhooks (CDC)

DomainEvent rows (from Payout and PaymentLink triggers) are streamed to Kafka via Debezium. The **webhook consumer** reads from Kafka and sends HTTP webhooks to merchants.

## 1. Start Kafka and Debezium Connect

```bash
docker compose -f docker/docker-compose.yml up -d
```

Wait until Connect is healthy: `curl -s http://localhost:8083/`.

## 2. Neon: logical replication

In [Neon Console](https://console.neon.tech) → your project → **Settings** → **Logical Replication** → **Enable**.

Then in SQL (Neon SQL Editor or `psql`):

- Create a publication for `DomainEvent`:

  ```sql
  CREATE PUBLICATION debezium_pub FOR TABLE "DomainEvent";
  ```

- Create the replication slot (use a role with `REPLICATION`):

  ```sql
  SELECT pg_create_logical_replication_slot('debezium', 'pgoutput');
  ```

See [Neon: Replicate with Kafka and Debezium](https://neon.com/docs/guides/logical-replication-kafka-confluent).

## 3. Register the Debezium connector

Use the **direct** Neon connection string (no `-pooler` in the host) for logical replication.

```bash
# Optional: use direct URL (recommended for replication)
export NEON_DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

pnpm exec tsx scripts/register-debezium-connector.ts
```

Connector name: `neon-domain-events`. It streams `public.DomainEvent` to topic `neon.public.DomainEvent`.

## 4. Run the webhook consumer

From repo root:

```bash
export DATABASE_URL="postgresql://..."
export KAFKA_BOOTSTRAP_SERVERS="localhost:9092"   # default
pnpm --filter api run webhook-consumer
```

Or from `apps/api`: `pnpm run webhook-consumer`.

The consumer subscribes to `neon.public.DomainEvent`, loads the merchant’s webhook URL, builds the webhook payload (payout.completed, payout.failed, payment.completed), and sends it via `sendWebhookAndWait`. Webhooks are **only** sent by this consumer (the API no longer sends them inline).

## Env summary

| Variable | Used by | Description |
|----------|---------|--------------|
| `DATABASE_URL` | API, consumer, register script | Postgres connection (pooler ok for API/consumer). |
| `NEON_DIRECT_URL` | register-debezium-connector.ts | Direct Neon URL (no pooler) for Debezium. |
| `KAFKA_BOOTSTRAP_SERVERS` | webhook-consumer | Default `localhost:9092`. |
| `KAFKA_DOMAIN_EVENT_TOPIC` | webhook-consumer | Default `neon.public.DomainEvent`. |
| `DEBEZIUM_CONNECT_URL` | register script | Default `http://localhost:8083`. |
