import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("playlists_tracks")
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("playlist_id", "integer", (c) => 
      c.notNull().references("playlists.id").onDelete("cascade")
    )
    .addColumn("track_id", "integer", (c) => 
      c.notNull().references("tracks.id").onDelete("cascade")
    )
    .addColumn("position", "integer", (c) => c.notNull())
    .execute()

  await db.schema
    .createIndex("playlists_tracks_playlist_id_idx")
    .on("playlists_tracks")
    .column("playlist_id")
    .execute();
  
  await db.schema
    .createIndex("playlists_tracks_track_id_idx")
    .on("playlists_tracks")
    .column("track_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("playlists_tracks").execute();
}