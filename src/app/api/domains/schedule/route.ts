import { z } from "zod";

import { findManagedDomain, updateDomainDeleteAt } from "@/infrastructure/db/domain-repository";
import { isAdmin } from "@/lib/auth";

const inputSchema = z.object({
  domainId: z.string().uuid(),
  deleteAt: z.string().datetime({ offset: true }).nullable(),
});

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "日時の指定を確認してください。" }, { status: 400 });
  if (parsed.data.deleteAt && Date.parse(parsed.data.deleteAt) <= Date.now()) return Response.json({ error: "削除日時は現在より後に指定してください。" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain) return Response.json({ error: "対象のサブドメインが見つかりません。" }, { status: 404 });
  if (["Executing", "Deleting"].includes(domain.status)) return Response.json({ error: "現在処理中のため、日時を変更できません。" }, { status: 409 });
  if (!(await updateDomainDeleteAt(domain.id, parsed.data.deleteAt))) return Response.json({ error: "日時を更新できませんでした。もう一度お試しください。" }, { status: 409 });
  return Response.json({ ok: true, deleteAt: parsed.data.deleteAt });
}
