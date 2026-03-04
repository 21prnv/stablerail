import "dotenv/config";

const CONNECT_URL = process.env.DEBEZIUM_CONNECT_URL ?? "http://localhost:8083";
const CONNECTOR_NAME = process.env.DEBEZIUM_CONNECTOR_NAME ?? "neon-domain-events";
const DATABASE_URL =
  process.env.NEON_DIRECT_URL ?? process.env.DATABASE_URL;

if (!DATABASE_URL || !DATABASE_URL.startsWith("postgres")) {
  console.error("Set DATABASE_URL or NEON_DIRECT_URL (use direct connection, not pooler, for logical replication).");
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const dbHost = url.hostname;
const dbPort = url.port || "5432";
const dbUser = url.username;
const dbPassword = url.password;
const dbName = url.pathname.replace(/^\//, "") || "neondb";

const connectorConfig = {
  name: CONNECTOR_NAME,
  config: {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": dbHost,
    "database.port": dbPort,
    "database.user": dbUser,
    "database.password": dbPassword,
    "database.dbname": dbName,
    "database.sslmode": "require",
    "plugin.name": "pgoutput",
    "slot.name": "debezium",
    "publication.name": "debezium_pub",
    "table.include.list": "public.DomainEvent",
    "topic.prefix": "neon",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
  },
};

async function main(): Promise<void> {
  const target = `${CONNECT_URL}/connectors/${CONNECTOR_NAME}/config`;
  const res = await fetch(
    `${CONNECT_URL}/connectors`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connectorConfig),
    }
  ).catch((e) => {
    console.error("Connect request failed:", e.message);
    process.exit(1);
  });

  if (res.ok) {
    const body = await res.json();
    console.log("Connector registered:", body);
    return;
  }

  if (res.status === 409) {
    const putRes = await fetch(target, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connectorConfig.config),
    });
    if (putRes.ok) {
      console.log("Connector config updated.");
      return;
    }
    console.error("Update failed:", putRes.status, await putRes.text());
    process.exit(1);
  }

  console.error("Register failed:", res.status, await res.text());
  process.exit(1);
}

main();
