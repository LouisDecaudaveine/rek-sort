# Project Summary

Goal: a music library app. Songs are stored in S3, metadata lives in a relational DB, and the browser plays and uploads directly against S3/CloudFront, with your code handling the control-plane calls.

## Core decisions so far

- **Database:** relational (Postgres). Tag intersection, playlist membership, and play-count filters fit SQL far better than DynamoDB.
- **Architecture:** Next.js frontend → Express API (REST → RPC) → service (`{ function, payload }` dispatcher) → DB.
- **Bulk data bypasses your servers.** Uploads go browser → S3 via presigned URLs; streaming goes CloudFront → browser via signed URLs.
- **The seam:** everything goes through a `dispatch(name, payload)` function, so you can start with one process and split later without touching route code.
- **RPC naming convention:** `<service>.<capability>`, e.g. `metadata.tracks.create`, `media.upload.init`. The prefix names the domain module, not the deployment unit — if Lambdas later merge or split, names don't change. `system.ping` (or `api.ping`) is the odd one out: the API's own health-style function rather than a service capability.
- **Tooling:** TypeScript (strict), ESLint (flat config), Express 5, Zod 4, **Kysely** as the query builder (no ORM — see Data Layer below).
- **Seeding:** the database is seeded/synced from an XML export (e.g. a rekordbox library export) that already contains full track metadata, including play count. Sync is a batch/replace-style operation against this XML, not a live event stream.

## Monorepo structure: "fake monorepo," not workspaces

No pnpm workspaces, no shared `node_modules`. Each app is a fully standalone Node project — its own `package.json`, its own lockfile, its own `node_modules`, its own `tsconfig.json`, its own `eslint.config.mts`. Nothing at the root is required for any individual app to run.

```
repo-root/
  apps/
    web/        # Next.js (Pages Router, static export) — independent project
    api/        # Express: REST → RPC — independent project [scaffolded]
    service/    # dispatcher + media/metadata handlers — independent project
    worker/     # plain Node queue consumer — independent project
  packages/
    contracts/  # future source of truth for RPC schemas — NOT an installable package, currently empty
    storage/    # future source of truth for the S3 wrapper — same deal, currently empty
  docker-compose.yml   # local infra only: Postgres, MinIO-compatible store, (later) LocalStack
  .env / .env.example  # compose-level config, root only
  .github/ (or similar CI config)
```

The root exists only to hold things with no single owning app: CI config, `docker-compose.yml`, root `.env`, maybe a Makefile/justfile for convenience commands like `dev-api`. Think of it as one directory to jump around the code in, not a build system.

**Current state:** only `apps/api` exists as a real project (scaffolded, `/health` route, `dispatch()` done). `packages/contracts` and `packages/storage` are placeholder directories only — nothing lives in them yet, and nothing should until a second app needs to consume the same contracts.

### The wrinkle this creates — `packages/contracts` and `packages/storage`

Without workspaces, an app can't import these from `node_modules`. Decided approach: copy at sync time. A small script will copy `packages/contracts/src` into each consuming app's gitignored `src/_contracts/` (and same pattern for storage wherever it's needed). This matches the "CI pulls whatever files it needs" model. Two alternatives considered and rejected for now: relative imports across app boundaries (risks two copies of zod resolving and type mismatches), and publishing as a real private package (overkill at this stage).

**Don't build the sync script yet — trigger is the moment `apps/service` is scaffolded and needs the same contracts `apps/api` already has.** Until then, `apps/api/src/contracts` is the live, directly-authored source, not a synced copy — no underscore prefix needed for a single-consumer file.

Each app still mirrors the same internal shape, e.g. `apps/api/src/{contracts,handlers,dispatch.ts,...}` — that's per-app internal organization, independent of the sync question above.

## Local infrastructure — Docker Compose (root-level)

**Status: done.** `docker-compose.yml` lives at the repo root and only describes infra you don't own — Compose's "services" are just containers it manages (Postgres, MinIO-compatible store, later LocalStack), unrelated to your own app's `service` layer. Your `api`/`service`/`worker` code is **not** containerized for local dev; it keeps running as plain `tsx watch` processes on your machine, talking to the containers over `localhost`. Containerizing your own app code is a separate, optional, later decision.

### Containers

- **`db`** — `postgres:16`, pinned to a major version so it keeps matching whatever Aurora Postgres version gets picked in Phase 2. Stand-in for Aurora; same engine locally and on AWS means little changes.
- **`minio`** — S3-compatible store for audio files. **Note:** the original plan assumed the official `minio/minio` image. MinIO Inc. stopped publishing Docker images for the community edition in October 2025 and archived the `minio/minio` repo in early 2026, so that image no longer pulls. Replaced with **`pgsty/minio`**, an actively-maintained community fork designed as a drop-in replacement (same env vars, same `server` command, same on-disk `/data` format). Pinned to a specific release tag, not `latest`, since this fork ships dated release tags rather than a reliable rolling `latest`.
- **LocalStack** (or similar) — for SQS. Add when the worker/queue step is actually being built, not before.

### Config: root `.env` for Compose

Compose auto-loads a `.env` file in the same directory as `docker-compose.yml` and substitutes `${VARS}` into the YAML before building container config — this is separate from, and unrelated to, injecting those vars into a container's `environment:` block (that still has to be wired up explicitly per key).

Rules settled on:
- `${VARNAME:-default}` fallback syntax is used throughout so the file still works if `.env` is missing.
- **Only the host side of a `host:container` port mapping is ever templated.** The container-side port is a fixed property of what the image listens on internally (Postgres always listens on `5432` inside its own container regardless of what your `.env` says) — templating it is a bug, not a preference. `"${POSTGRES_PORT:-5432}:5432"` is correct; `"${POSTGRES_PORT}:${POSTGRES_PORT}"` is not.
- `.env` is gitignored; `.env.example` is committed with the same dummy dev values as a template for a fresh clone.
- This same mechanism is what will let CI inject different values (e.g. real random passwords) without touching the compose file itself.

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: pgsty/minio:RELEASE.2026-06-18T00-00-00Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_data:/data

volumes:
  pgdata:
  minio_data:
```

Named volumes (`pgdata`, `minio_data`) persist data across `docker compose down`; only `docker compose down -v` destroys them. Bucket creation and CORS config for MinIO (needed for multipart uploads) is deliberately deferred to the multipart-upload build-order step, not set up now.

## Data layer: Kysely, no ORM

Decision: **Kysely** as the query builder. This is a type-safe SQL builder, not an ORM — no entity/object mapping, no implicit queries, SQL stays visible and explicit. Fits the "learn how this actually works" goal better than something like Prisma. Repo layer = thin TypeScript functions (`getTrackById`, `createTrack`, `addTagToTrack`, etc.) built on Kysely queries, sitting between dispatch handlers and the DB.

Still open: which migration approach to pair with Kysely (hand-written SQL migrations run via `kysely-migration-cli` or similar, vs. some other tool) — not yet decided.

## Data model

### `tracks`
`id`, `name`, `artist`, `album`, `s3_key`, `play_count`, `bpm`, `key`, `date_added` (+ `status` for uploads).

`play_count` is a **plain static column**, not an event table — it's sourced directly from the XML at sync/seed time and overwritten on resync, not incremented by application logic. (This resolves what was previously an open question in the original plan — no `plays` event table is needed for now.)

- **`bpm numeric(5,2)`** — matches rekordbox's own precision (BPM to the hundredth, e.g. `128.00`); an integer column would lose precision rekordbox actually stores.
- **`key text`** — normalized to **Camelot notation** (e.g. `8A`) at sync time, regardless of which notation the source XML uses. Store the normalized form only; don't keep the raw/original notation alongside it unless a future need for it shows up.
- **`date_added timestamptz`** — sourced from the XML's date-added field at sync time (not file creation time, not first-seen-by-this-app time). Indexed, since "recently added" is a common sort/filter:

```sql
create index tracks_date_added_idx on tracks (date_added);
```

### `tags` and `track_tags` (junction)

```sql
create table track_tags (
  track_id integer not null references tracks(id) on delete cascade,
  tag_id   integer not null references tags(id) on delete cascade,
  primary key (track_id, tag_id)
);

create index track_tags_tag_id_idx on track_tags (tag_id);
```

- **Composite primary key** `(track_id, tag_id)`: a track either has a tag or doesn't — there's no meaningful "duplicate" row, and nothing else needs to reference "track_tags row #N" independently, so a surrogate `id` column would be pure overhead.
- **Reverse index on `tag_id`:** the composite PK is ordered by `track_id` first, so it only makes "what tags does this track have" fast. Tag-intersection queries (tracks with tag A *and* tag B *and* tag C) — the whole reason Postgres was chosen over DynamoDB — go the other direction, tag → tracks, so that direction needs its own explicit index or it falls back to a full table scan.
- **`ON DELETE CASCADE`** on both FKs: sync is a resync-from-XML workflow, so when a track (or tag) is deleted, orphaned junction rows should disappear automatically rather than requiring hand-ordered cleanup logic in every deletion path. No reason to preserve an orphaned tag-assignment row.

### `playlists` and `playlist_tracks` (junction, with `position`)

**Confirmed: the same track can appear more than once in the same playlist** (common in DJ software). This rules out a composite `(playlist_id, track_id)` primary key, since two legitimate rows would collide on it.

```sql
create table playlist_tracks (
  id          serial primary key,
  playlist_id integer not null references playlists(id) on delete cascade,
  track_id    integer not null references tracks(id) on delete cascade,
  position    integer not null
);

create index playlist_tracks_playlist_id_idx on playlist_tracks (playlist_id);
create index playlist_tracks_track_id_idx on playlist_tracks (track_id);
```

- **Surrogate `id` key** here instead of composite: the pairing isn't unique on its own (duplicates are allowed), so the row needs its own identity to be addressable (e.g. for reordering — updating a specific row's `position` — or removing one specific occurrence of a repeated track without touching the others).
- **Both directions indexed explicitly:** `playlist_id` for "list this playlist's tracks in order," `track_id` for "which playlists contain this track" (e.g. for tag/playlist-combined queries, or cleanup checks) — neither is free from the surrogate key alone, so both are added deliberately rather than assumed.
- **`ON DELETE CASCADE`** on both FKs, same reasoning as `track_tags`.

## Flows to build

1. **Metadata CRUD:** REST → RPC → repo → Postgres. Includes tag-AND queries, playlist queries, and the play-count filter.
2. **Upload:** browser lists chosen files → `media.upload.init` (service validates, creates pending rows, presigns URLs) → browser PUTs directly to the S3-compatible store (multipart for large files, needing bucket CORS with the ETag header exposed) → worker processes the file and marks it ready.
3. **Playback:** `media.stream.getUrl` → a playable URL → `<audio>` streams from storage.

## Suggested build order

1. Project scaffold for `apps/api`: standalone project, tsconfig, ESLint, first `/health` route — ✅ done
2. `dispatch()` plus the response envelope, error mapping, and zod validation per function — ✅ done
3. Root `docker-compose.yml` with Postgres + MinIO-compatible store, root `.env`/`.env.example` — ✅ done
4. Schema plus repo layer (Kysely, junction table design above) — **next**
5. Metadata slice end to end through the browser
6. Single small file upload (skip multipart)
7. Playback URLs
8. Queue + worker (bring in LocalStack here), then multipart and folder uploads

**Done when:** you can select a folder, watch tracks appear, tag them, add them to playlists, query by tags/playlist/play count, and play them.

## Phase 2: Deployed on AWS (serverless-leaning) — unchanged from original plan

Routing: a single CloudFront distribution.

```
Browser → CloudFront ─┬─ /*       → frontend (S3, or Amplify/OpenNext if SSR)
                       ├─ /api/*   → API Gateway → API Lambda ─Invoke→ Service Lambda → Aurora
                       └─ /media/* → S3 media bucket (via OAC, signed URLs)
```

Relative URLs mean no CORS, and the frontend never needs to know where the API lives.

**Components:**
- **Frontend:** static export to S3 + CloudFront if no SSR; Amplify Hosting or OpenNext/SST if SSR is needed.
- **API:** Express on Lambda behind API Gateway HTTP API or Function URL (serverless-express or Lambda Web Adapter). Scales to zero.
- **Service:** its own Lambda, called by the API via SDK Invoke. No public URL, IAM-controlled.
- **Database:** Aurora Serverless v2 (Postgres), min capacity 0. Pauses when idle, resumes in ~15s. Storage still billed.
- **Uploads:** presigned S3 URLs → S3 event → SQS → worker (Lambda, or Fargate for long jobs; look at MediaConvert too).
- **Streaming:** service signs CloudFront URLs. Key in Secrets Manager, bucket private behind Origin Access Control.

**Watch-outs:**
- RDS Proxy (or any connection-holding proxy) prevents Aurora from pausing — think about how Lambdas manage connections.
- NAT Gateways cost ~$30/month even idle. Use VPC endpoints for S3 and other AWS services instead.
- Cold starts stack up: Lambda + Aurora resume on first request after idle.
- Bucket lifecycle rules should abort incomplete multipart uploads.
- Least-privilege IAM for every role.

**Suggested learning order:**
1. S3 + CloudFront static hosting for the frontend
2. Aurora Serverless v2 and connecting to it from a Lambda in a VPC
3. Express on Lambda + API Gateway
4. Service Lambda and the API → service Invoke
5. S3 presigned uploads
6. SQS + worker
7. CloudFront signed URLs + OAC for streaming
8. Infrastructure as code (CDK, SST, or Terraform), ideally adopted from step 1

## Open blanks to revisit

- Does the frontend need any SSR? Decides S3 static vs Amplify/OpenNext.
- Authentication: who verifies identity, and how is it passed through API → service?
- Streaming format: single file per track vs HLS (brings signed cookies)?
- Upload limits: presigned PUT vs presigned POST for size enforcement?
- Which IaC tool to use?
- Worker runtime: Lambda vs Fargate, depending on processing time.
- How the frontend learns an upload has finished: polling vs WebSocket/SSE?
- When does the `packages/contracts` → app sync script get written, and is it a plain Node script or something more structured? (Trigger: `apps/service` scaffolding.)
- Kysely migration tooling — which approach for writing/running schema migrations.
- ~~Play counts: column vs event table~~ — **resolved:** static column, sourced from XML at sync time.