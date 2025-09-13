import {
  boolean,
  jsonb,
  pgTable,
  text,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const nodes = pgTable("memory-nodes", {
  id: uuid("id").primaryKey(),
  type: text("type").notNull(),
  sessionId: uuid("session_id").notNull(),
  properties: jsonb("properties").notNull(),
});

export const edges = pgTable("memory-edges", {
  id: uuid("id").primaryKey(),
  from: uuid("from")
    .notNull()
    .references(() => nodes.id),
  to: uuid("to")
    .notNull()
    .references(() => nodes.id),
  label: text("label").notNull(),
  sessionId: uuid("session_id").notNull(),
  message: text("message").notNull(),
  embedding: vector("embedding", {
    dimensions: 1536,
  }),
  invalid: boolean("invalid").notNull().default(false),
});
