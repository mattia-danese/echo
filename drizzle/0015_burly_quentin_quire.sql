CREATE TABLE "ambassadors" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	"deactivated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_fkey" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;