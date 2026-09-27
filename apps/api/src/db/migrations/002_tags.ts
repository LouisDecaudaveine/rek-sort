import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("tags")
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tags").execute();
}