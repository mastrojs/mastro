import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import cursor from "pg-cursor";

import type { Database } from "./types.ts";

// Configure the connection with PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD.
// See https://node-postgres.com/features/connecting
const pool = new Pool();
pool.on("error", (e: Error) => console.error(e));

const dialect = new PostgresDialect({ pool, cursor });

export type DB = Kysely<Database>;

export const db = new Kysely<Database>({ dialect });
