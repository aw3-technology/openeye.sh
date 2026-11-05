/**
 * Owner-scoped CRUD over Neon for the dashboard. Replaces direct Supabase
 * table access from the browser.
 *
 *   GET    /api/data/:resource?col=value&ids=a,b&limit=&offset=&count=1
 *   POST   /api/data/:resource                 body: row
 *   GET    /api/data/:resource/:id
 *   PATCH  /api/data/:resource/:id             body: partial row
 *   DELETE /api/data/:resource/:id
 *   DELETE /api/data/:resource?col=value       (at least one filter required)
 *   POST   /api/data/avatar                    body: image bytes → { url }
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import pg from "pg";
import { put } from "@vercel/blob";
import { pool } from "./_lib/db.js";
import { resources, type Resource } from "./_lib/resources.js";
import {
  HttpError,
  handleError,
  pathSegments,
  readJson,
  readRawBody,
  requireUser,
  restoreRewrittenUrl,
  sendJson,
} from "./_lib/http.js";

// Return numeric columns as numbers, matching what PostgREST returned.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 1000;
const AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function assertUuid(id: string) {
  if (!UUID_RE.test(id)) throw new HttpError(400, "Invalid id");
}

function selectList(r: Resource) {
  return r.extraSelect ? `t.*, ${r.extraSelect}` : "t.*";
}

/** Builds `user_id = $1 and col = $n ...` from allowed query filters. */
function buildWhere(r: Resource, userId: string, query: URLSearchParams) {
  const params: unknown[] = [userId];
  const clauses = ["t.user_id = $1"];
  for (const col of r.filters) {
    const value = query.get(col);
    if (value === null) continue;
    params.push(value);
    clauses.push(`t.${col} = $${params.length}`);
  }
  const ids = query.get("ids");
  if (ids !== null) {
    const list = ids.split(",").filter(Boolean);
    list.forEach(assertUuid);
    params.push(list);
    clauses.push(`t.id = any($${params.length}::uuid[])`);
  }
  return { where: clauses.join(" and "), params, filtered: clauses.length > 1 };
}

/** Keeps only writable columns and serializes jsonb ones. */
function pickRow(r: Resource, body: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const col of r.writable) {
    if (!(col in body)) continue;
    const value = body[col];
    row[col] = r.json?.includes(col) && value !== null && value !== undefined ? JSON.stringify(value) : value;
  }
  return row;
}

/** Rejects references to rows the user does not own (e.g. someone else's device). */
async function assertRefsOwned(r: Resource, userId: string, row: Record<string, unknown>) {
  for (const [col, table] of Object.entries(r.refs ?? {})) {
    const value = row[col];
    if (value === null || value === undefined) continue;
    assertUuid(String(value));
    const { rowCount } = await pool.query(`select 1 from ${table} where id = $1 and user_id = $2`, [value, userId]);
    if (!rowCount) throw new HttpError(404, `${col} not found`);
  }
}

async function list(r: Resource, userId: string, query: URLSearchParams) {
  const { where, params } = buildWhere(r, userId, query);
  const limit = Math.min(Number(query.get("limit")) || MAX_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(query.get("offset")) || 0, 0);
  const { rows } = await pool.query(
    `select ${selectList(r)} from ${r.table} t where ${where} order by t.${r.order} limit ${limit} offset ${offset}`,
    params,
  );
  if (query.get("count") !== "1") return { data: rows };
  const { rows: countRows } = await pool.query(`select count(*)::int as count from ${r.table} t where ${where}`, params);
  return { data: rows, count: countRows[0].count as number };
}

async function getOne(r: Resource, userId: string, id: string) {
  assertUuid(id);
  const { rows } = await pool.query(
    `select ${selectList(r)} from ${r.table} t where t.id = $1 and t.user_id = $2`,
    [id, userId],
  );
  if (!rows[0]) throw new HttpError(404, "Not found");
  return rows[0];
}

async function create(r: Resource, userId: string, body: Record<string, unknown>) {
  if (r.noCreate) throw new HttpError(405, "Method not allowed");
  const row = pickRow(r, body);
  await assertRefsOwned(r, userId, row);
  const cols = ["user_id", ...Object.keys(row)];
  const values = [userId, ...Object.values(row)];
  const { rows } = await pool.query(
    `insert into ${r.table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    values,
  );
  return getOne(r, userId, rows[0].id);
}

async function update(r: Resource, userId: string, id: string, body: Record<string, unknown>) {
  assertUuid(id);
  const row = pickRow(r, body);
  const cols = Object.keys(row);
  if (cols.length === 0) return getOne(r, userId, id);
  await assertRefsOwned(r, userId, row);
  const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(", ");
  const { rowCount } = await pool.query(
    `update ${r.table} set ${sets} where id = $1 and user_id = $2`,
    [id, userId, ...Object.values(row)],
  );
  if (!rowCount) throw new HttpError(404, "Not found");
  return getOne(r, userId, id);
}

async function remove(r: Resource, userId: string, id: string | undefined, query: URLSearchParams) {
  if (id) {
    assertUuid(id);
    const { rowCount } = await pool.query(`delete from ${r.table} where id = $1 and user_id = $2`, [id, userId]);
    if (!rowCount) throw new HttpError(404, "Not found");
    return { deleted: 1 };
  }
  const { where, params, filtered } = buildWhere(r, userId, query);
  if (!filtered) throw new HttpError(400, "A filter is required for bulk delete");
  const { rowCount } = await pool.query(`delete from ${r.table} t where ${where}`, params);
  return { deleted: rowCount ?? 0 };
}

async function uploadAvatar(req: IncomingMessage, userId: string) {
  const contentType = (req.headers["content-type"] || "").split(";")[0].trim();
  const ext = AVATAR_TYPES[contentType];
  if (!ext) throw new HttpError(415, "Avatar must be PNG, JPEG, WebP or GIF");
  const body = await readRawBody(req, 2 * 1024 * 1024);
  const blob = await put(`avatars/${userId}/avatar.${ext}`, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  restoreRewrittenUrl(req, "/api/data");
  try {
    const user = await requireUser(req);
    const { segments, query } = pathSegments(req, "/api/data");
    const [name, id, ...extra] = segments;
    const method = req.method || "GET";

    if (name === "avatar" && method === "POST" && !id) {
      return sendJson(res, 200, await uploadAvatar(req, user.id));
    }

    const r = name ? resources[name] : undefined;
    if (!r || extra.length > 0) throw new HttpError(404, "Unknown resource");

    if (!id) {
      if (method === "GET") return sendJson(res, 200, await list(r, user.id, query));
      if (method === "POST") return sendJson(res, 201, await create(r, user.id, await readJson(req)));
      if (method === "DELETE") return sendJson(res, 200, await remove(r, user.id, undefined, query));
    } else {
      if (method === "GET") return sendJson(res, 200, await getOne(r, user.id, id));
      if (method === "PATCH") return sendJson(res, 200, await update(r, user.id, id, await readJson(req)));
      if (method === "DELETE") return sendJson(res, 200, await remove(r, user.id, id, query));
    }
    throw new HttpError(405, "Method not allowed");
  } catch (err) {
    handleError(res, err, "api/data");
  }
}
