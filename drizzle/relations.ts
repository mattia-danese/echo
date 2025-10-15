import { relations } from "drizzle-orm/relations";
import { echoSessions, playlists, users, userEchoSessions, userTrackPlays, playlistSongs, friends } from "./schema";

export const playlistsRelations = relations(playlists, ({one, many}) => ({
	echoSession: one(echoSessions, {
		fields: [playlists.sessionId],
		references: [echoSessions.id]
	}),
	user: one(users, {
		fields: [playlists.userId],
		references: [users.id]
	}),
	playlistSongs: many(playlistSongs),
}));

export const echoSessionsRelations = relations(echoSessions, ({many}) => ({
	playlists: many(playlists),
	userEchoSessions: many(userEchoSessions),
}));

export const usersRelations = relations(users, ({many}) => ({
	playlists: many(playlists),
	userEchoSessions: many(userEchoSessions),
	userTrackPlays: many(userTrackPlays),
	playlistSongs: many(playlistSongs),
	friends_friendId: many(friends, {
		relationName: "friends_friendId_users_id"
	}),
	friends_userId: many(friends, {
		relationName: "friends_userId_users_id"
	}),
}));

export const userEchoSessionsRelations = relations(userEchoSessions, ({one}) => ({
	echoSession: one(echoSessions, {
		fields: [userEchoSessions.sessionId],
		references: [echoSessions.id]
	}),
	user: one(users, {
		fields: [userEchoSessions.userId],
		references: [users.id]
	}),
}));

export const userTrackPlaysRelations = relations(userTrackPlays, ({one}) => ({
	user: one(users, {
		fields: [userTrackPlays.userId],
		references: [users.id]
	}),
}));

export const playlistSongsRelations = relations(playlistSongs, ({one}) => ({
	playlist: one(playlists, {
		fields: [playlistSongs.playlistId],
		references: [playlists.id]
	}),
	user: one(users, {
		fields: [playlistSongs.submittedByUserId],
		references: [users.id]
	}),
}));

export const friendsRelations = relations(friends, ({one}) => ({
	user_friendId: one(users, {
		fields: [friends.friendId],
		references: [users.id],
		relationName: "friends_friendId_users_id"
	}),
	user_userId: one(users, {
		fields: [friends.userId],
		references: [users.id],
		relationName: "friends_userId_users_id"
	}),
}));