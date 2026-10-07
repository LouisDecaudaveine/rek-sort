import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("playlists")
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("rb_path", "text", (c) => c.unique())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("playlists").execute();
}