import { NextRequest } from "next/server";
import { z } from "zod";
import { createSessionValue, sessionCookie, verifyAdminPassword } from "@/lib/auth";

const loginInput = z.object({ password: z.string().min(1).max(1024) });
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "invalid_request" }, { status: 403 });
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.resetAt > now && current.count >= 5) return Response.json({ error: "too_many_attempts" }, { status: 429 });
  const body = loginInput.safeParse(await request.json().catch(() => null));
  if (!body.success || !verifyAdminPassword(body.data.password)) {
    attempts.set(key, { count: current && current.resetAt > now ? current.count + 1 : 1, resetAt: now + 15 * 60 * 1000 });
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  attempts.delete(key);
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${sessionCookie.name}=${createSessionValue()}; Path=/; Max-Age=${sessionCookie.maxAge}; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
