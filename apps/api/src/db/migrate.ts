import { promises as fs } from "node:fs";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { db } from "./index";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((r) => {
    console.log(`${r.status === "Success" ? "BBINGO" : "NEENAW"} ${r.migrationName}`);
  });

  if (error) {
    console.error("Migration failed:", error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();