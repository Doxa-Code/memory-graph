ALTER TABLE "memory-edges" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "memory-nodes" ADD COLUMN "properties" jsonb DEFAULT '{}'::jsonb NOT NULL;