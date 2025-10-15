import { pgTable, unique, bigint, varchar, timestamp, boolean, foreignKey, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const users = pgTable("users", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	firstName: varchar("first_name").default('').notNull(),
	lastName: varchar("last_name").default('').notNull(),
	phoneNumber: varchar("phone_number").default('').notNull(),
	spotifyAccessToken: varchar("spotify_access_token").default(''),
	spotifyRefreshToken: varchar("spotify_refresh_token").default(''),
	spotifyTokenExpiresAt: timestamp("spotify_token_expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	friendLinkToken: varchar("friend_link_token").default('').notNull(),
	spotifyUserId: varchar("spotify_user_id"),
	onboardingToken: varchar("onboarding_token").default('').notNull(),
	isOnboardingComplete: boolean("is_onboarding_complete").default(false).notNull(),
	appleMusicAccessToken: varchar("apple_music_access_token"),
	appleMusicRefreshToken: varchar("apple_music_refresh_token"),
	appleMusicTokenExpiresAt: timestamp("apple_music_token_expires_at", { withTimezone: true, mode: 'string' }),
	appleMusicUserId: varchar("apple_music_user_id"),
	platform: varchar().notNull(),
}, (table) => [
	unique("users_phone_number_key").on(table.phoneNumber),
	unique("users_friend_link_token_key").on(table.friendLinkToken),
	unique("users_onboarding_token_key").on(table.onboardingToken),
]);

export const playlists = pgTable("playlists", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "playlists_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sessionId: bigint("session_id", { mode: "number" }).notNull(),
	platformPlaylistId: varchar("platform_playlist_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	platform: varchar().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [echoSessions.id],
			name: "playlists_session_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "playlists_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("playlists_spotify_playlist_id_key").on(table.platformPlaylistId),
]);

export const userEchoSessions = pgTable("user_echo_sessions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "user_echo_sessions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sessionId: bigint("session_id", { mode: "number" }).notNull(),
	token: varchar().notNull(),
	trackId: varchar("track_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	platform: varchar().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [echoSessions.id],
			name: "user_echo_sessions_session_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_echo_sessions_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("user_echo_sessions_token_key").on(table.token),
]);

export const userTrackPlays = pgTable("user_track_plays", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "user_track_plays_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	platform: varchar().notNull(),
	trackId: varchar("track_id").notNull(),
	trackName: varchar("track_name").notNull(),
	artists: varchar().notNull(),
	albumImageUrl: varchar("album_image_url").notNull(),
	playedAt: timestamp("played_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_track_plays_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	unique("unique_user_track_play").on(table.userId, table.trackId, table.playedAt),
]);

export const echoSessions = pgTable("echo_sessions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "echo_session_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	start: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	end: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const playlistSongs = pgTable("playlist_songs", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "playlist_songs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playlistId: bigint("playlist_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submittedByUserId: bigint("submitted_by_user_id", { mode: "number" }).notNull(),
	trackId: varchar("track_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlists.id],
			name: "playlist_songs_playlist_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.submittedByUserId],
			foreignColumns: [users.id],
			name: "playlist_songs_submitted_by_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const friends = pgTable("friends", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	friendId: bigint("friend_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.friendId],
			foreignColumns: [users.id],
			name: "friends_friend_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "friends_user_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.friendId], name: "friends_pkey"}),
]);
