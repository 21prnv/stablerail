/// <reference types="node" />
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { apiKey: "orbitx-demo-key-123" },
    update: { webhookSecret: "orbitx-demo-webhook-secret" },
    create: {
      name: "Demo Merchant",
      apiKey: "orbitx-demo-key-123",
      webhookUrl: "https://webhook.site/your-unique-id",
      webhookSecret: "orbitx-demo-webhook-secret",
    },
  });
  console.log("Seeded merchant:", merchant.name, "| API Key: orbitx-demo-key-123 | Webhook secret: orbitx-demo-webhook-secret");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
