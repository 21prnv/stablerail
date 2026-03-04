import "dotenv/config";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !DATABASE_URL.startsWith("postgres")) {
  console.error("Missing or invalid DATABASE_URL. Set it in .env (repo root or packages/database).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();

  try {
    const triggerCheck = await client.query(`
      SELECT t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'Payout' AND NOT t.tgisinternal
    `);
    const hasTrigger = triggerCheck.rows.some((r: { trigger_name: string }) =>
      r.trigger_name.includes("payout") || r.trigger_name.includes("domain")
    );

    if (!hasTrigger || triggerCheck.rows.length === 0) {
      console.log("Creating trigger and function...");
      await client.query(`
        CREATE OR REPLACE FUNCTION create_payout_domain_event()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.status IS DISTINCT FROM NEW.status
             AND NEW.status IN ('completed', 'failed') THEN
            INSERT INTO "DomainEvent" (id, "merchantId", "eventType", "objectId", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              NEW."merchantId",
              'payout.' || NEW.status,
              NEW.id,
              NOW()
            );
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await client.query(`DROP TRIGGER IF EXISTS on_payout_status_change ON "Payout";`);
      await client.query(`
        CREATE TRIGGER on_payout_status_change
          AFTER UPDATE ON "Payout"
          FOR EACH ROW
          EXECUTE FUNCTION create_payout_domain_event();
      `);
      console.log("Trigger and function created.");
    } else {
      console.log("Payout trigger already exists:", triggerCheck.rows.map((r: { trigger_name: string }) => r.trigger_name));
    }

    const paymentLinkTriggerCheck = await client.query(`
      SELECT t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE c.relname = 'PaymentLink' AND NOT t.tgisinternal
    `);
    const hasPaymentLinkTrigger = paymentLinkTriggerCheck.rows.some((r: { trigger_name: string }) =>
      r.trigger_name.includes("payment_link") || r.trigger_name.includes("domain")
    );

    if (!hasPaymentLinkTrigger || paymentLinkTriggerCheck.rows.length === 0) {
      console.log("Creating PaymentLink trigger and function...");
      await client.query(`
        CREATE OR REPLACE FUNCTION create_payment_link_domain_event()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.status IS DISTINCT FROM NEW.status
             AND NEW.status IN ('paid', 'expired') THEN
            INSERT INTO "DomainEvent" (id, "merchantId", "eventType", "objectId", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              NEW."merchantId",
              'payment_link.' || NEW.status,
              NEW.id,
              NOW()
            );
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await client.query(`DROP TRIGGER IF EXISTS on_payment_link_status_change ON "PaymentLink";`);
      await client.query(`
        CREATE TRIGGER on_payment_link_status_change
          AFTER UPDATE ON "PaymentLink"
          FOR EACH ROW
          EXECUTE FUNCTION create_payment_link_domain_event();
      `);
      console.log("PaymentLink trigger and function created.");
    } else {
      console.log("PaymentLink trigger already exists:", paymentLinkTriggerCheck.rows.map((r: { trigger_name: string }) => r.trigger_name));
    }

    const payouts = await client.query(
      `SELECT id, status, "merchantId" FROM "Payout" WHERE status NOT IN ('completed', 'failed') LIMIT 1`
    );
    if (payouts.rows.length === 0) {
      console.log("No Payout in non-terminal state. Creating one for testing...");
      const merchants = await client.query(`SELECT id FROM "Merchant" LIMIT 1`);
      if (merchants.rows.length === 0) {
        console.error("No Merchant found. Run db:seed first.");
        return;
      }
      const insert = await client.query(
        `INSERT INTO "Payout" (id, "merchantId", amount, currency, status, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, '100', 'USDC', 'requested', NOW(), NOW()) RETURNING id`,
        [merchants.rows[0].id]
      );
      payouts.rows[0] = { id: insert.rows[0].id, status: "requested", merchantId: merchants.rows[0].id };
    }

    const payoutId = payouts.rows[0].id;
    console.log("Test payout id:", payoutId, "current status:", payouts.rows[0].status);

    const before = await client.query(`SELECT COUNT(*)::int AS c FROM "DomainEvent"`);
    console.log("DomainEvent count before UPDATE:", before.rows[0].c);

    await client.query(`UPDATE "Payout" SET status = 'completed' WHERE id = $1`, [payoutId]);

    const after = await client.query(`SELECT COUNT(*)::int AS c FROM "DomainEvent"`);
    console.log("DomainEvent count after Payout UPDATE:", after.rows[0].c);

    if (after.rows[0].c > before.rows[0].c) {
      console.log("\nPayout: trigger fired and inserted a row into DomainEvent.");
    } else {
      console.log("\nPayout: no new row in DomainEvent. Trigger may not have fired or table name may differ.");
    }

    const linkCountBefore = await client.query(`SELECT COUNT(*)::int AS c FROM "DomainEvent"`);
    const paymentLinks = await client.query(
      `SELECT id, status, "merchantId" FROM "PaymentLink" WHERE status = 'pending' LIMIT 1`
    );
    if (paymentLinks.rows.length > 0) {
      const linkId = paymentLinks.rows[0].id;
      console.log("\nPaymentLink test: updating link", linkId, "to paid...");
      await client.query(`UPDATE "PaymentLink" SET status = 'paid' WHERE id = $1`, [linkId]);
      const linkCountAfter = await client.query(`SELECT COUNT(*)::int AS c FROM "DomainEvent"`);
      if (linkCountAfter.rows[0].c > linkCountBefore.rows[0].c) {
        console.log("PaymentLink: trigger fired, new DomainEvent row(s) created.");
      } else {
        console.log("PaymentLink: no new DomainEvent row (trigger may not have fired).");
      }
    } else {
      console.log("\nPaymentLink: no pending link to test; create one from the dashboard and mark it paid to verify the trigger.");
    }

    const finalRows = await client.query(
      `SELECT id, "merchantId", "eventType", "objectId", "createdAt" FROM "DomainEvent" ORDER BY "createdAt" DESC LIMIT 5`
    );
    console.log("\nLatest DomainEvent rows:", JSON.stringify(finalRows.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
