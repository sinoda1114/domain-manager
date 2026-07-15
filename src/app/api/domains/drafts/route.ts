import { z } from "zod";

import { createDraftDomain } from "@/infrastructure/db/domain-repository";
import { ensureProviderTarget, listProviderTargets } from "@/infrastructure/providers/targets";
import { isAdmin } from "@/lib/auth";

const inputSchema = z.object({
  label: z.string().min(1).max(63),
  provider: z.string(),
  targetId: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });

  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });

  try {
    const target = ensureProviderTarget(await listProviderTargets(), input.data);
    const domain = await createDraftDomain({
      label: input.data.label,
      provider: target.provider,
      providerTargetId: target.id,
      providerTargetName: target.name,
      requestedBy: "admin",
    });
    return Response.json({ domain }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: domains\.fqdn/i.test(error.message)) {
      return Response.json({ error: "このサブドメインは既に登録されています。別の名前を選んでください。" }, { status: 409 });
    }
    return Response.json({ error: "下書きを作成できませんでした。入力内容と公開先を確認して、もう一度お試しください。" }, { status: 400 });
  }
}
