import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { DB } from "./types";

const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  }),
});

export const db = new Kysely<DB>({ dialect });
