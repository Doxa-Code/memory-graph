CREATE TABLE "memory-nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_id" text NOT NULL,
	"labels" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
ALTER TABLE "memory-episodes" ALTER COLUMN "group_id" SET NOT NULL;