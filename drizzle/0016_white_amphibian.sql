ALTER TABLE "playlists" DROP CONSTRAINT "playlists_platform_playlist_id_key";--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "is_generic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_platform_platform_playlist_id_non_generic_key" ON "playlists" USING btree ("platform","platform_playlist_id") WHERE "playlists"."is_generic" = false;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_session_id_key" UNIQUE("user_id","session_id");