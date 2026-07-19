import { z } from "zod";

import { findManagedDomain, updateDomainDisplayName } from "@/infrastructure/db/domain-repository";
import { isAdmin } from "@/lib/auth";

const inputSchema = z.object({
  domainId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(100),
});

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "サービス名は1〜100文字で入力してください。" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain) return Response.json({ error: "対象のサブドメインが見つかりません。" }, { status: 404 });
  if (["Executing", "Deleting"].includes(domain.status)) return Response.json({ error: "現在処理中のため、サービス名を変更できません。" }, { status: 409 });
  if (!(await updateDomainDisplayName(domain.id, parsed.data.displayName))) return Response.json({ error: "サービス名を更新できませんでした。もう一度お試しください。" }, { status: 409 });
  return Response.json({ ok: true, displayName: parsed.data.displayName });
}
