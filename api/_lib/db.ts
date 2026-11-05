import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

/** Shared Neon connection pool (pooled DATABASE_URL). */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

attachDatabasePool(pool);
