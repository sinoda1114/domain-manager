import { generateDomainSuggestions, suggestionRequestSchema } from "@/lib/domain-suggestions";
import { isAdmin } from "@/lib/auth";

const publicRequestLimit = 5;
const publicRequestWindowMs = 60_000;
const publicRequests = new Map<string, { count: number; resetAt: number }>();

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasPublicRequestCapacity(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const current = publicRequests.get(key);
  if (current && current.resetAt > now && current.count >= publicRequestLimit) return false;
  publicRequests.set(key, { count: current && current.resetAt > now ? current.count + 1 : 1, resetAt: current && current.resetAt > now ? current.resetAt : now + publicRequestWindowMs });
  return true;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    // トップ画面は公開しているため、候補生成だけは同一オリジンから利用できるようにする。
    // 外部サイトからの呼び出しとGemini APIの過剰利用はここで抑止する。
    if (!isSameOrigin(request)) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
    if (!hasPublicRequestCapacity(request)) return Response.json({ error: "候補生成の利用回数が上限に達しました。1分ほど待ってから再試行してください。" }, { status: 429 });
  }
  const input = suggestionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  try {
    const response = Response.json({ groups: await generateDomainSuggestions(input.data) });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("domain_suggestion_failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "候補を生成できませんでした。設定と入力内容を確認して再試行してください。" }, { status: 503 });
  }
}
