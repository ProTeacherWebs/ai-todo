import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.TURSO_DATABASE_URL?.trim() || "file:local.db";
const isTursoCloud = url.startsWith("libsql:") || url.startsWith("https:");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: isTursoCloud ? "turso" : "sqlite",
  dbCredentials: isTursoCloud
    ? {
        url,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      }
    : {
        url,
      },
});
