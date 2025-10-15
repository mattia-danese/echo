import {
  boolean,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { Platform } from "./types";

const platform = pgEnum("platform", [Platform.SPOTIFY, Platform.APPLE_MUSIC]);

const timestamps = {
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    firstName: varchar("first_name").notNull(),
    lastName: varchar("last_name").notNull(),
    phoneNumber: varchar("phone_number").notNull(),
    friendLinkToken: varchar("friend_link_token").notNull(),
    onboardingToken: varchar("onboarding_token").notNull(),
    isOnboardingComplete: boolean("is_onboarding_complete")
      .default(false)
      .notNull(),
    receivedNoTextAlert: boolean("received_no_text_alert")
      .default(false)
      .notNull(),
    platform: platform("platform").notNull(),

    // spotify
    spotifyUserId: varchar("spotify_user_id"),
    spotifyAccessToken: varchar("spotify_access_token"),
    spotifyRefreshToken: varchar("spotify_refresh_token"),
    spotifyTokenExpiresAt: timestamp("spotify_token_expires_at", {
      withTimezone: true,
      mode: "string",
    }),

    // appleMusic
    // appleMusicAccessToken: varchar("apple_music_access_token"),
    // appleMusicRefreshToken: varchar("apple_music_refresh_token"),
    // appleMusicTokenExpiresAt: timestamp("apple_music_token_expires_at", { withTimezone: true, mode: 'string' }),
    // appleMusicUserId: varchar("apple_music_user_id"),

    ...timestamps,
  },
  (table) => [
    unique("users_phone_number_key").on(table.phoneNumber),
    unique("users_friend_link_token_key").on(table.friendLinkToken),
    unique("users_onboarding_token_key").on(table.onboardingToken),
  ],
);

export const friends = pgTable(
  "friends",
  {
    userId: integer("user_id").notNull(),
    friendId: integer("friend_id").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.friendId],
      name: "friends_pkey",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "friends_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.friendId],
      foreignColumns: [users.id],
      name: "friends_friend_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const userTrackPlays = pgTable(
  "user_track_plays",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),
    platform: platform("platform").notNull(),

    trackId: varchar("track_id").notNull(),
    trackName: varchar("track_name").notNull(),
    artists: varchar("artists").notNull(),
    albumImageUrl: varchar("album_image_url").notNull(),

    // FIXME: might need to change for apple music if we dont get the played at time
    playedAt: timestamp("played_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_track_plays_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    // FIXME: might need to change for apple music if we dont get the played at time
    unique("unique_user_track_play").on(
      table.userId,
      table.trackId,
      table.playedAt,
    ),
  ],
);

export const echoSessions = pgTable("echo_sessions", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  start: timestamp("start", { withTimezone: true, mode: "string" }).notNull(),
  end: timestamp("end", { withTimezone: true, mode: "string" }).notNull(),

  createdAt: timestamps.createdAt,
});

export const userEchoSessions = pgTable(
  "user_echo_sessions",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    userId: integer("user_id").notNull(),
    sessionId: integer("session_id").notNull(),
    token: varchar("token").notNull(),

    platform: platform("platform").notNull(),
    trackId: varchar("track_id"), //nullable if user never submits a song

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_echo_sessions_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [echoSessions.id],
      name: "user_echo_sessions_session_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("user_echo_sessions_token_key").on(table.token),
  ],
);

export const playlists = pgTable(
  "playlists",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    userId: integer("user_id").notNull(),
    sessionId: integer("session_id").notNull(),

    platform: platform("platform").notNull(),
    platformPlaylistId: varchar("platform_playlist_id").notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "playlists_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [echoSessions.id],
      name: "playlists_session_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("playlists_platform_playlist_id_key").on(table.platformPlaylistId),
  ],
);

export const playlistSongs = pgTable(
  "playlist_songs",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    playlistId: integer("playlist_id").notNull(),
    trackId: varchar("track_id").notNull(),
    submittedByUserId: integer("submitted_by_user_id").notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.submittedByUserId],
      foreignColumns: [users.id],
      name: "playlist_songs_submitted_by_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.playlistId],
      foreignColumns: [playlists.id],
      name: "playlist_songs_playlist_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);
