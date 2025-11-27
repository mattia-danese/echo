ALTER TABLE "users" DROP CONSTRAINT "users_onboarding_token_key";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "when_onboarding_complete" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_onboarding_complete";