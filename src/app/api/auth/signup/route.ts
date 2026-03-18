import {
  createSessionToken,
  getSessionCookieOptions,
  isValidEmail,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  hashPassword,
} from "@/lib/auth";
import { ensureCollections, getUsersCollection } from "@/lib/db-init";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { email?: string; password?: string };
  try {
    payload = (await request.json()) as { email?: string; password?: string };
  } catch {
    return new NextResponse("Invalid request body", { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? "");
  const password = payload.password ?? "";

  if (!isValidEmail(email)) {
    return new NextResponse("Please provide a valid email.", { status: 400 });
  }
  if (password.length < 8) {
    return new NextResponse("Password must be at least 8 characters.", { status: 400 });
  }

  await ensureCollections();
  const users = await getUsersCollection();

  const existing = await users.findOne({ email });
  if (existing) {
    return new NextResponse("Email is already registered.", { status: 409 });
  }

  const now = new Date();
  const insertResult = await users.insertOne({
    email,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });

  const token = createSessionToken({
    userId: insertResult.insertedId.toHexString(),
    email,
  });

  const response = NextResponse.json({ authenticated: true, email });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
