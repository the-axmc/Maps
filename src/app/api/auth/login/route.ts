import {
  createSessionToken,
  getSessionCookieOptions,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  verifyPassword,
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

  try {
    await ensureCollections();
    const users = await getUsersCollection();
    const user = await users.findOne({ email });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return new NextResponse("Invalid email or password.", { status: 401 });
    }

    const token = createSessionToken({
      userId: user._id.toHexString(),
      email: user.email,
    });

    const response = NextResponse.json({
      authenticated: true,
      email: user.email,
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return new NextResponse(
      "Login failed. Check MongoDB connection and AUTH_SECRET.",
      { status: 500 }
    );
  }
}
