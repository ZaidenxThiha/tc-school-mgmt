// Supabase Database types — placeholder.
//
// Until generated, this file exports `any` so the typed `createClient<Database>`
// wiring in client.ts / server.ts / middleware.ts behaves identically to an
// untyped client. Run:
//
//   npm run db:types
//
// to overwrite this file with real Row / Insert / Update / Args types generated
// from the live schema (wraps `supabase gen types typescript --linked --schema public`).
// No call-site changes are required when that happens — the wiring is already in place.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = any;
