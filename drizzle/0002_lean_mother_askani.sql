CREATE TABLE "memory-edges" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"label" text NOT NULL,
	"fact" text DEFAULT '' NOT NULL,
	"episodes" text[] NOT NULL,
	"valid_at" timestamp DEFAULT now() NOT NULL,
	"invalid_at" timestamp,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory-episodes" ALTER COLUMN "labels" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memory-nodes" ALTER COLUMN "labels" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memory-nodes" ALTER COLUMN "embedding" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memory-nodes" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_source_id_memory-nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."memory-nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_target_id_memory-nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."memory-nodes"("id") ON DELETE cascade ON UPDATE no action;