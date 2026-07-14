import { sessionCookie } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${sessionCookie.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
