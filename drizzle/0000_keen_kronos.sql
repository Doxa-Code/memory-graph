CREATE TABLE "memory-edges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from" uuid NOT NULL,
	"to" uuid NOT NULL,
	"label" text NOT NULL,
	"session_id" uuid NOT NULL,
	"message" text NOT NULL,
	"embedding" vector(1536),
	"invalid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory-nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"session_id" uuid NOT NULL,
	"properties" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_from_memory-nodes_id_fk" FOREIGN KEY ("from") REFERENCES "public"."memory-nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_to_memory-nodes_id_fk" FOREIGN KEY ("to") REFERENCES "public"."memory-nodes"("id") ON DELETE no action ON UPDATE no action;