import type { Generated, ColumnType } from "kysely";

export interface TracksTable {
  id: Generated<number>;
  rb_id: number | null;
  name: string;
  artist: string | null;
  album: string | null;
  s3_key: string | null;
  play_count: number;
  bpm: number | null;
  key: string | null;
  date_added: ColumnType<Date, string | Date, string | Date>;
  status: string;
}

export interface TagTable {
  id: Generated<Number>;
  rb_id: number;
  name: string;
}

export interface TracksTagsTable {
  track_id: number;
  tag_id: number;
}

export interface PlaylistsTable {
  id: Generated<number>;
  rb_path: string;
  name: string;
}

export interface PlaylistsTracksTable {
  id: Generated<number>;
  playlist_id: number;
  track_id: number;
  position: number;
}

export interface DB {
  tracks: TracksTable;
  tags: TagTable;
  tracks_tags: TracksTagsTable;
  playlists: PlaylistsTable;
  playlists_tracks: PlaylistsTracksTable;
}