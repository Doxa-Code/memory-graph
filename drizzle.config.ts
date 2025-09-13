import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "node:path";

export default defineConfig({
  out: "drizzle",
  schema: path.resolve("./database/schemas.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    schema: "public",
  },
});
