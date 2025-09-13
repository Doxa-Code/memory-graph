CREATE TABLE "memory-episode-edges" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"edge_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory-episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"message" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory-episode-edges" ADD CONSTRAINT "memory-episode-edges_episode_id_memory-episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."memory-episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory-episode-edges" ADD CONSTRAINT "memory-episode-edges_edge_id_memory-edges_id_fk" FOREIGN KEY ("edge_id") REFERENCES "public"."memory-edges"("id") ON DELETE cascade ON UPDATE no action;