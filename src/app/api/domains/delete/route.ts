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

async function hasCloudflareDnsRecord(fqdn: string, env: ReturnType<typeof getProviderEnv>) {
  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${encodeURIComponent(fqdn)}&page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw new Error("dns_check_failed");
    if (Array.isArray(body.result) && body.result.length > 0) return true;
    const totalPages = body.result_info?.total_pages;
    if (!Number.isInteger(totalPages) || totalPages < page) throw new Error("dns_check_pagination_invalid");
    if (totalPages === page) return false;
  }
  throw new Error("dns_check_pagination_failed");
}

async function assertPagesProject(domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>, env: ReturnType<typeof getProviderEnv>) {
  const projectResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    cache: "no-store",
  });
  const projectBody = await projectResponse.json().catch(() => ({}));
  if (!projectResponse.ok || !projectBody.success || projectBody.result?.id !== domain.providerTargetId) throw new Error("pages_project_mismatch");
}

async function hasPagesCustomDomain(fqdn: string, domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>, env: ReturnType<typeof getProviderEnv>) {
  await assertPagesProject(domain, env);
  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains?page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.success) throw new Error("pages_check_failed");
    if (Array.isArray(body.result) && body.result.some((entry: { name?: unknown }) => entry?.name === fqdn)) return true;
    const totalPages = body.result_info?.total_pages;
    if (!Number.isInteger(totalPages) || totalPages < page) throw new Error("pages_check_pagination_invalid");
    if (totalPages === page) return false;
  }
  throw new Error("pages_check_pagination_failed");
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
  if (domain.status === "Failed" && resources.length === 0) {
    if (domain.provider !== "cloudflare_pages") return Response.json({ error: "外部設定の状態を確認できないため、安全のため削除を停止しました。" }, { status: 409 });
    try {
      const env = getProviderEnv();
      const [hasDns, hasPagesDomain] = await Promise.all([hasCloudflareDnsRecord(domain.fqdn, env), hasPagesCustomDomain(domain.fqdn, domain, env)]);
      if (hasDns || hasPagesDomain) return Response.json({ error: "外部設定が残っているため、安全のため削除を停止しました。" }, { status: 409 });
      await markDomainDeleted(domain.id);
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: "外部設定の状態を確認できないため、安全のため削除を停止しました。" }, { status: 409 });
    }
  }
  if (domain.provider === "vercel" && (!customDomain || !dnsRecord)) return Response.json({ error: "このドメインの所有情報が不足しているため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider !== "vercel" && !customDomain && domain.status !== "Draft") return Response.json({ error: "このドメインの所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider === "cloudflare_pages" && domain.status !== "Draft" && !dnsRecord) return Response.json({ error: "DNS設定の所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });

  try {
    const env = getProviderEnv();
    if (domain.status !== "Draft") {
      if (domain.provider === "vercel") {
        const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(domain.providerTargetId)}/domains/${encodeURIComponent(domain.fqdn)}?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` } });
        if (!response.ok) throw new Error("vercel_delete_failed");
        if (!dnsRecord) throw new Error("dns_record_missing");
        await deleteCloudflareDnsRecord(dnsRecord.externalId, env);
      } else if (domain.provider === "cloudflare_pages") {
        await assertPagesProject(domain, env);
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains/${encodeURIComponent(domain.fqdn)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.success) throw new Error("pages_delete_failed");
        if (!dnsRecord) throw new Error("dns_record_missing");
        await deleteCloudflareDnsRecord(dnsRecord.externalId, env);
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
