import postgres from 'postgres';

// Single Postgres client for the app (Neon). DATABASE_URL is injected by Vercel
// (and read from .env for local). `prepare: false` is required behind the Neon
// pgbouncer pooler.
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__sql ??
  postgres(connectionString, { ssl: 'require', prepare: false, max: 5, idle_timeout: 20 });

if (process.env.NODE_ENV !== 'production') global.__sql = sql;
