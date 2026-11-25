import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

export const isTursoCloud =
  url.startsWith("libsql:") || url.startsWith("https:");

export const client = createClient(authToken ? { url, authToken } : { url });

export const db = drizzle(client, { schema });
export * from "./schema";

let initPromise: Promise<void> | null = null;

export async function ensureDatabaseInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          quadrant TEXT NOT NULL,
          category TEXT NOT NULL,
          priority_reason TEXT NOT NULL,
          deadline TEXT,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS subtasks (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)
      `);
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  return initPromise;
}
