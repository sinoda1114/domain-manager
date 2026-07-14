import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";

const cookieName = "domain_manager_session";
const sessionLifetimeSeconds = 60 * 60 * 8;
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export function verifyAdminPassword(password: string): boolean {
  const [, cost, blockSize, parallelism, salt, expected] = getServerEnv().ADMIN_PASSWORD_HASH.split("$");
  if (!cost || !blockSize || !parallelism || !salt || !expected) return false;
  const expectedBuffer = Buffer.from(expected, "base64url");
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expectedBuffer.length, { N: Number(cost), r: Number(blockSize), p: Number(parallelism), maxmem: 128 * 1024 * 1024 });
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function createSessionValue(): string {
  const secret = getServerEnv().AUTH_SECRET;
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Math.floor(Date.now() / 1000) + sessionLifetimeSeconds })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidSession(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload, getServerEnv().AUTH_SECRET);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return session.role === "admin" && typeof session.exp === "number" && session.exp > Date.now() / 1000;
  } catch { return false; }
}

export const sessionCookie = { name: cookieName, maxAge: sessionLifetimeSeconds };

export async function isAdmin(): Promise<boolean> {
  return isValidSession((await cookies()).get(cookieName)?.value);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/login");
}
