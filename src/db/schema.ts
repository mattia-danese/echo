import { eq } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { Gender, MessageType, Platform } from "./types";

const platform = pgEnum("platform", [Platform.SPOTIFY, Platform.APPLE_MUSIC]);
const gender = pgEnum("gender", [
  Gender.MALE,
  Gender.FEMALE,
  Gender.PREFER_NOT_TO_SAY,
]);
const messageType = pgEnum("message_type", [
  MessageType.INBOUND,
  MessageType.OUTBOUND,
]);

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
    gender: gender("gender").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    friendLinkToken: varchar("friend_link_token").notNull(),
    whenOnboardingComplete: timestamp("when_onboarding_complete", {
      withTimezone: true,
      mode: "string",
    }),
    receivedNoTextAlert: boolean("received_no_text_alert")
      .default(false)
      .notNull(),
    platform: platform("platform").notNull(),
    hasCrossPlatformFriends: boolean("has_cross_platform_friends")
      .default(false)
      .notNull(),
    profilePictureUrl: varchar("profile_picture_url"), //nullable
    isDeleted: boolean("is_deleted").default(false).notNull(),
    sentGetLink: boolean("sent_get_link").default(false).notNull(),
    firstSharedSessionId: integer("first_shared_session_id"),
    referredByUserId: integer("referred_by_user_id"),

    ...timestamps,
  },
  (table) => [
    unique("users_phone_number_key").on(table.phoneNumber),
    unique("users_friend_link_token_key").on(table.friendLinkToken),
    foreignKey({
      columns: [table.firstSharedSessionId],
      foreignColumns: [echoSessions.id],
      name: "users_first_shared_session_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.referredByUserId],
      foreignColumns: [table.id],
      name: "users_referred_by_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
  ],
);

export const ambassadors = pgTable(
  "ambassadors",
  {
    userId: integer("user_id").primaryKey().notNull(),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    deactivatedAt: timestamp("deactivated_at", {
      withTimezone: true,
      mode: "string",
    }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "ambassadors_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const userAuth = pgTable(
  "user_auth",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),

    platform: platform("platform").notNull(),
    platformUserId: varchar("platform_user_id"),
    accessToken: varchar("access_token").notNull(),
    refreshToken: varchar("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    extra: jsonb("extra").default({}).notNull(),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_auth_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("user_auth_user_id_key").on(table.userId),
  ],
);

export const friends = pgTable(
  "friends",
  {
    userId: integer("user_id").notNull(),
    friendId: integer("friend_id").notNull(),
    muted: boolean("muted").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
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

    platform: platform("platform"), //nullable if user never submits a song
    trackId: varchar("track_id"), //nullable if user never submits a song
    trackName: varchar("track_name"), //nullable if user never submits a song
    trackArtists: varchar("track_artists"), //nullable if user never submits a song
    trackAlbumImageUrl: varchar("track_album_image_url"), //nullable if user never submits a song

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
    playlistName: varchar("playlist_name").notNull(),
    playlistImageUrl: varchar("playlist_image_url").notNull(),
    isGeneric: boolean("is_generic").default(false).notNull(),

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
    unique("playlists_user_id_session_id_key").on(
      table.userId,
      table.sessionId,
    ),
    // Non-generic playlists should be unique per platform playlist id.
    uniqueIndex("playlists_platform_platform_playlist_id_non_generic_key")
      .on(table.platform, table.platformPlaylistId)
      .where(eq(table.isGeneric, false)),
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

export const songlinkCache = pgTable(
  "songlink_cache",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    title: varchar("title").notNull(),
    artists: varchar("artists").notNull(),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    unique("songlink_cache_title_artists_key").on(table.title, table.artists),
  ],
);

export const songLinkCacheMappings = pgTable(
  "songlink_cache_mappings",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    songlinkCacheId: integer("songlink_cache_id").notNull(),
    platform: platform("platform").notNull(),
    trackId: varchar("track_id").notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.songlinkCacheId],
      foreignColumns: [songlinkCache.id],
      name: "songlink_cache_mappings_songlink_cache_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("songlink_cache_mappings_platform_track_id_key").on(
      table.platform,
      table.trackId,
    ),
    unique("songlink_cache_mappings_platform_songlink_cache_id_key").on(
      table.platform,
      table.songlinkCacheId,
    ),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),
    tokenHash: varchar("token_hash").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "auth_sessions_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    unique("auth_sessions_token_hash_key").on(table.tokenHash),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),
    messageType: messageType("message_type").notNull(),
    message: varchar("message").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "messages_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const appleDevToken = pgTable("apple_dev_token", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  token: varchar("token").notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),

  ...timestamps,
});

export const spotifyAuth = pgTable("spotify_auth", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar("user_id").notNull(),
  accessToken: varchar("access_token").notNull(),
  refreshToken: varchar("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),

  ...timestamps,
});

export const userRecommendedSongs = pgTable(
  "user_recommended_songs",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),

    trackId: varchar("track_id").notNull(),
    trackName: varchar("track_name").notNull(),
    trackArtists: varchar("track_artists").notNull(),
    trackAlbumImageUrl: varchar("track_album_image_url").notNull(),
    platform: platform("platform").notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_recommended_songs_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const userRankings = pgTable(
  "user_rankings",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id").notNull(),

    rankedUserId: integer("ranked_user_id").notNull(),
    playlistId: integer("playlist_id").notNull(),

    createdAt: timestamps.createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_rankings_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.rankedUserId],
      foreignColumns: [users.id],
      name: "user_rankings_ranked_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.playlistId],
      foreignColumns: [playlists.id],
      name: "user_rankings_playlist_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);
