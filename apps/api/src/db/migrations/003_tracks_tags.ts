import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("tracks_tags")
    .addColumn("track_id", "integer", (c) => 
      c.notNull().references("tracks.id").onDelete("cascade")
    )
    .addColumn("tag_id", "integer", (c) => 
      c.notNull().references("tags.id").onDelete("cascade")
    )
    .addPrimaryKeyConstraint("tracks_tags_pkey", ["track_id", "tag_id"])
    .execute();

  await db.schema
    .createIndex("tracks_tags_tag_id_idx")
    .on("tracks_tags")
    .column("tag_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("tracks_tags").execute();
}