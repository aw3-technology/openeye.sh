// Applies db/schema.sql to the Neon database in DATABASE_URL_UNPOOLED (or DATABASE_URL).
// Usage: node --env-file=.env.local scripts/db-migrate.mjs
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  );
  console.log(`Schema applied. Tables: ${rows.map((r) => r.table_name).join(", ")}`);
} finally {
  await client.end();
}
