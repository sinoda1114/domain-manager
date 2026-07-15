import { z } from "zod";

import { findManagedDomain, updateDomainVerification } from "@/infrastructure/db/domain-repository";
import { isAdmin } from "@/lib/auth";
import { verifyPublicDomain } from "@/lib/domain-verification";

const input = z.object({ domainId: z.string().uuid() });

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain) return Response.json({ error: "対象のドメインが見つかりません。" }, { status: 404 });
  const status = await verifyPublicDomain(domain.fqdn);
  await updateDomainVerification(domain.id, status);
  return Response.json({ ok: true, status });
}
