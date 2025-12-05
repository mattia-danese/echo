"use server";

import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { env } from "@/lib/env";

const SESSION_COOKIE_NAME = "echo_session";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  const digest = crypto.createHash("sha256").update(rawToken).digest();
  return digest.toString("base64url");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function createSession(userId: number) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ONE_DAY_MS);

  await db.insert(authSessions).values({
    userId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  });

  await setSessionCookie(token, expiresAt);
}

export async function validateSession(): Promise<null | { userId: number }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const tokenHash = hashToken(raw);

  const [session] = await db
    .select({ userId: authSessions.userId })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        gt(authSessions.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);

  if (!session) return null;
  return { userId: session.userId };
}

export async function getCurrentUser() {
  const validated = await validateSession();
  if (!validated) return null;

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      platform: users.platform,
      profilePictureUrl: users.profilePictureUrl,
      phoneNumber: users.phoneNumber,
    })
    .from(users)
    .where(eq(users.id, validated.userId))
    .limit(1);

  if (!user) return null;
  return user;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return;
  const tokenHash = hashToken(raw);
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
  await clearSessionCookie();
}

export async function deleteAllSessionsForUser(
  userId: number,
  clearCookie = true,
) {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
  if (clearCookie) {
    await clearSessionCookie();
  }
}
