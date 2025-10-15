CREATE TYPE "public"."platform" AS ENUM('spotify', 'apple-music');--> statement-breakpoint
ALTER TABLE "echo_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "friends" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlist_songs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlists" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_echo_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_track_plays" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playlists" DROP CONSTRAINT IF EXISTS "playlists_spotify_playlist_id_key";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone_number" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "spotify_access_token" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "spotify_refresh_token" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "friend_link_token" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "platform" SET DATA TYPE "public"."platform" USING "platform"::"public"."platform";--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "session_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "platform" SET DATA TYPE "public"."platform" USING "platform"::"public"."platform";--> statement-breakpoint
ALTER TABLE "user_echo_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_echo_sessions" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "user_echo_sessions" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_echo_sessions" ALTER COLUMN "session_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_echo_sessions" ALTER COLUMN "platform" SET DATA TYPE "public"."platform" USING "platform"::"public"."platform";--> statement-breakpoint
ALTER TABLE "user_track_plays" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_track_plays" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "user_track_plays" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_track_plays" ALTER COLUMN "platform" SET DATA TYPE "public"."platform" USING "platform"::"public"."platform";--> statement-breakpoint
ALTER TABLE "echo_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "echo_sessions" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "playlist_songs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "playlist_songs" ALTER COLUMN "id" SET MAXVALUE 2147483647;--> statement-breakpoint
ALTER TABLE "playlist_songs" ALTER COLUMN "playlist_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "playlist_songs" ALTER COLUMN "submitted_by_user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "friends" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "friends" ALTER COLUMN "friend_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "friends" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "friends" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "apple_music_access_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "apple_music_refresh_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "apple_music_token_expires_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "apple_music_user_id";--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_platform_playlist_id_key" UNIQUE("platform_playlist_id");