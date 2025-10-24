CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'non binary', 'prefer not to say');

ALTER TABLE "users" ADD COLUMN "gender" "gender" NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date NOT NULL;