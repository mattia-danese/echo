ALTER TABLE "friends" ADD COLUMN "muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "friends" ADD COLUMN "active" boolean DEFAULT true NOT NULL;