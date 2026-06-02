// Pool Postgres partagé (le front tourne sur le même VPS que la base).
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 6,
    idleTimeoutMillis: 30000,
  });

if (process.env.NODE_ENV !== "production") global._pgPool = pool;

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await pool.query(sql, params);
  return (r.rows[0] as T) ?? null;
}
