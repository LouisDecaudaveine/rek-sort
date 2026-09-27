import { Kysely } from "kysely";

export async function up(db: Kysely<any>):Promise<void> {
  await db.schema 
    .createTable("tracks")
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("rb_id", "integer", (col) => col.unique())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("artist", "text")
    .addColumn("album", "text")
    .addColumn("s3_key", "text")
    .addColumn("play_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("bpm", "real")
    .addColumn("key", "text")
    .addColumn("date_added", "timestamptz", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("tracks_date_added_idx")
    .on("tracks")
    .column("date_added")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tracks").execute();
}