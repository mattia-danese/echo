ALTER TABLE "user_auth" ALTER COLUMN "platform_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_auth" ALTER COLUMN "refresh_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_auth" ALTER COLUMN "token_expires_at" DROP NOT NULL;