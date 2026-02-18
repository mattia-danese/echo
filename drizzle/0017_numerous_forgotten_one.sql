CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlist_songs_playlist_id_idx" ON "playlist_songs" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlists_session_id_idx" ON "playlists" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "songlink_cache_mappings_track_id_idx" ON "songlink_cache_mappings" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "user_rankings_user_id_created_at_idx" ON "user_rankings" USING btree ("user_id","created_at");