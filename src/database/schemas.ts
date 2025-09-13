import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const episodes = pgTable("memory-episodes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  message: text("message").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const episodeEdges = pgTable("memory-episode-edges", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  edgeId: text("edge_id")
    .notNull()
    .references(() => edges.id, { onDelete: "cascade" }),
});

export const nodes = pgTable("memory-nodes", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  sessionId: text("session_id").notNull(),
  label: text("label").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull().default([]),
  properties: jsonb("properties").notNull().default({}),
  summary: text("summary").notNull().default(""),
});

export const edges = pgTable("memory-edges", {
  id: text("id").primaryKey(),
  from: text("from")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  to: text("to")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fact: text("fact").notNull().default(""),
  sessionId: text("session_id").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  invalid: boolean("invalid").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
