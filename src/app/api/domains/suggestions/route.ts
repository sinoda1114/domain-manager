import { generateDomainSuggestions, suggestionRequestSchema } from "@/lib/domain-suggestions";
import { isAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
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
