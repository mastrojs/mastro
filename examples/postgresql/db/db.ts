import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import cursor from "pg-cursor";
import { Database } from "./types.ts";

// Deno (both locally and on Deno Deploy) should automatically set the right
// environment variables, see https://docs.deno.com/deploy/reference/databases/
// For pg docs, see https://node-postgres.com
const pool = new Pool();
pool.on("error", (e: Error) => console.error(e));

const dialect = new PostgresDialect({ pool, cursor });

export type DB = Kysely<Database>;

export const db = new Kysely<Database>({ dialect });
