CREATE TABLE "memory-edges" (
	"id" text PRIMARY KEY NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"label" text NOT NULL,
	"fact" text DEFAULT '' NOT NULL,
	"session_id" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"invalid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory-nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"session_id" text NOT NULL,
	"label" text NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_from_memory-nodes_id_fk" FOREIGN KEY ("from") REFERENCES "public"."memory-nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory-edges" ADD CONSTRAINT "memory-edges_to_memory-nodes_id_fk" FOREIGN KEY ("to") REFERENCES "public"."memory-nodes"("id") ON DELETE cascade ON UPDATE no action;