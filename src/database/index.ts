import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export const createDatabaseConnection = () => {
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 30000,
    });
    db = drizzle(sql);
    db.$client = sql;
  }
  return db!;
};
