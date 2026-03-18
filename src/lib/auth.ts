import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const SESSION_COOKIE_NAME = "bc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_PREFIX = "scrypt";

export type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

const getAuthSecret = () => {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("Missing AUTH_SECRET environment variable");
  }
  return authSecret;
};

const toBase64Url = (value: string) => Buffer.from(value, "utf8").toString("base64url");

const fromBase64Url = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) => {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const createSessionToken = ({ userId, email }: { userId: string; email: string }) => {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifySessionToken = (token: string | undefined | null): SessionPayload | null => {
  if (!token) return null;
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!payload.userId || !payload.email || !payload.exp) return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const getSessionFromCookies = (cookieStore: ReadonlyRequestCookies): SessionPayload | null => {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_HASH_PREFIX}$${salt}$${hash}`;
};

export const verifyPassword = (password: string, storedHash: string): boolean => {
  const [algorithm, salt, hash] = storedHash.split("$");
  if (algorithm !== PASSWORD_HASH_PREFIX || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, 64);
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(expected, candidate);
};
