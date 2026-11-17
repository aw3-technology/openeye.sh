import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

/** Shared Neon connection pool (pooled DATABASE_URL). */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  // Neon's pooler drops connections that sit idle; let the pool retire them
  // first so a warm instance rarely holds a dead one.
  idleTimeoutMillis: 10_000,
});

// An idle client whose connection the server closed ("Connection terminated
// unexpectedly", 2026-11-16) is reported as a pool 'error' event. With no
// listener Node treats it as an uncaught exception and the function crashes.
// The pool has already discarded that client and the next query opens a new
// connection, so there is nothing to recover beyond logging it.
pool.on("error", (err) => {
  console.warn(`[db] idle connection dropped: ${err.message}`);
});

attachDatabasePool(pool);
