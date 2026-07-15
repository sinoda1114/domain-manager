import { z } from "zod";

import { findManagedDomain, listOwnedManagedResources, markDomainDeleted } from "@/infrastructure/db/domain-repository";
import { isAdmin } from "@/lib/auth";
import { getProviderEnv } from "@/lib/env";

const input = z.object({ domainId: z.string().uuid(), confirmation: z.string().min(1) });

async function deleteCloudflareDnsRecord(recordId: string, env: ReturnType<typeof getProviderEnv>) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${encodeURIComponent(recordId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error("dns_delete_failed");
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain) return Response.json({ error: "対象のドメインが見つかりません。" }, { status: 404 });
  if (parsed.data.confirmation !== `${domain.fqdn}を削除`) return Response.json({ error: "確認文が一致しません。表示された文字列をそのまま入力してください。" }, { status: 400 });
  if (domain.status === "Executing") return Response.json({ error: "反映処理中のため、今は削除できません。" }, { status: 409 });

  const resources = await listOwnedManagedResources(domain.id);
  const customDomain = resources.find((resource) => resource.resourceType === "custom_domain" && resource.ownershipFingerprint === `${domain.id}:${resource.externalId}`);
  const dnsRecord = resources.find((resource) => resource.resourceType === "dns_record" && resource.provider === "cloudflare" && resource.ownershipFingerprint === `${domain.id}:${resource.externalId}`);
  if (domain.provider === "vercel" && (!customDomain || !dnsRecord)) return Response.json({ error: "このドメインの所有情報が不足しているため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider !== "vercel" && !customDomain && domain.status !== "Draft") return Response.json({ error: "このドメインの所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider === "cloudflare_pages" && domain.status !== "Draft" && !dnsRecord) return Response.json({ error: "DNS設定の所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });

  try {
    const env = getProviderEnv();
    if (domain.status !== "Draft") {
      if (domain.provider === "vercel") {
        const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(domain.providerTargetId)}/domains/${encodeURIComponent(domain.fqdn)}?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` } });
        if (!response.ok) throw new Error("vercel_delete_failed");
        await deleteCloudflareDnsRecord(dnsRecord!.externalId, env);
      } else if (domain.provider === "cloudflare_pages") {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetId)}/domains/${encodeURIComponent(domain.fqdn)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.success) throw new Error("pages_delete_failed");
        await deleteCloudflareDnsRecord(dnsRecord!.externalId, env);
      } else if (domain.provider === "cloudflare_workers") {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/domains/${encodeURIComponent(domain.fqdn)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.success) throw new Error("workers_delete_failed");
      }
    }
    await markDomainDeleted(domain.id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "外部サービスの削除に失敗しました。状態を変えずに残しています。" }, { status: 502 });
  }
}
