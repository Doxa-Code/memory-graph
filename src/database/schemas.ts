import { pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";
import type { Episode } from "../episode";

export const episodes = pgTable("memory-episodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  groupId: text("group_id").notNull(),
  labels: text("labels").array().notNull(),
  type: text("type").$type<Episode.Type>().notNull(),
  content: text("content").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nodes = pgTable("memory-nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  groupId: text("group_id").notNull(),
  summary: text("summary").notNull(),
  labels: text("labels").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});

export const edges = pgTable("memory-edges", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  sourceId: text("source_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  targetId: text("target_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fact: text("fact").notNull().default(""),
  episodes: text("episodes").array().notNull(),
  validAt: timestamp("valid_at").defaultNow().notNull(),
  invalidAt: timestamp("invalid_at"),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});
