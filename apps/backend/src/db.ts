import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

/**
 * Pool único de conexões com o Neon (URL com -pooler).
 * Na Vercel (Fluid compute) o pool é reaproveitado entre requisições e
 * `attachDatabasePool` fecha conexões ociosas antes de a instância ser suspensa.
 */
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 5000 });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}
