import { z } from "zod";

import { findManagedDomain, listOwnedManagedResources, markDomainDeleted, markDomainDeletionFailed, markManagedResourceDeleted } from "@/infrastructure/db/domain-repository";
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
  if (!projectResponse.ok || !projectBody.success || projectBody.result?.id !== domain.providerTargetId || typeof projectBody.result?.subdomain !== "string") throw new Error("pages_project_mismatch");
  return projectBody.result.subdomain as string;
}

async function hasOwnedCloudflareDnsRecord(fqdn: string, recordId: string, expectedTarget: string, env: ReturnType<typeof getProviderEnv>) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${encodeURIComponent(recordId)}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success || !body.result) throw new Error("dns_record_check_failed");
  const normalize = (value: unknown) => typeof value === "string" ? value.replace(/\.$/, "").toLowerCase() : "";
  return body.result.id === recordId && body.result.type === "CNAME" && normalize(body.result.name) === normalize(fqdn) && normalize(body.result.content) === normalize(expectedTarget);
}

async function findPagesCustomDomainId(fqdn: string, domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>, env: ReturnType<typeof getProviderEnv>) {
  await assertPagesProject(domain, env);
  for (let page = 1; page <= 100; page += 1) {
    let unpaginatedFallback = false;
    let response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains?page=${page}&per_page=20`, {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      cache: "no-store",
    });
    let body = await response.json().catch(() => ({}));
    if (!response.ok && page === 1 && body.errors?.some((error: { code?: unknown }) => error?.code === 8000024)) {
      unpaginatedFallback = true;
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains`, {
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        cache: "no-store",
      });
      body = await response.json().catch(() => ({}));
    }
    if (!response.ok || !body.success) throw new Error("pages_check_failed");
    if (!Array.isArray(body.result)) throw new Error("pages_check_result_invalid");
    const match = body.result.find((entry: { id?: unknown; name?: unknown }) => entry?.name === fqdn);
    if (match) {
      if (typeof match.id !== "string" || !match.id) throw new Error("pages_check_id_invalid");
      return match.id;
    }
    if (unpaginatedFallback) {
      const fallbackTotalPages = body.result_info?.total_pages;
      if (!Number.isInteger(fallbackTotalPages) || fallbackTotalPages !== 1) throw new Error("pages_check_pagination_unsupported");
      return undefined;
    }
    const totalPages = body.result_info?.total_pages;
    if (!Number.isInteger(totalPages) || totalPages < page) throw new Error("pages_check_pagination_invalid");
    if (totalPages === page) return undefined;
  }
  throw new Error("pages_check_pagination_failed");
}

async function hasAnyPagesCustomDomain(fqdn: string, domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>, env: ReturnType<typeof getProviderEnv>) {
  return Boolean(await findPagesCustomDomainId(fqdn, domain, env));
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!cronAuthorized && !(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain) return Response.json({ error: "対象のドメインが見つかりません。" }, { status: 404 });
  if (parsed.data.confirmation !== `${domain.fqdn}を削除`) return Response.json({ error: "確認文が一致しません。表示された文字列をそのまま入力してください。" }, { status: 400 });
  if (cronAuthorized && (domain.status !== "Deleting" || !domain.deleteAt || Date.parse(domain.deleteAt) > Date.now())) return Response.json({ error: "自動削除の期限を確認できないため、処理を停止しました。" }, { status: 409 });
  if (domain.status === "Executing") return Response.json({ error: "反映処理中のため、今は削除できません。" }, { status: 409 });
  if (domain.status === "Deleting" && !cronAuthorized) return Response.json({ error: "自動削除処理中のため、しばらく待ってください。" }, { status: 409 });

  const resources = await listOwnedManagedResources(domain.id);
  const customDomain = resources.find((resource) => resource.resourceType === "custom_domain" && resource.ownershipFingerprint === `${domain.id}:${resource.externalId}`);
  const dnsRecord = resources.find((resource) => resource.resourceType === "dns_record" && resource.provider === "cloudflare" && resource.ownershipFingerprint === `${domain.id}:${resource.externalId}`);
  if (domain.status === "Failed" && resources.length === 0) {
    if (domain.provider !== "cloudflare_pages") return Response.json({ error: "外部設定の状態を確認できないため、安全のため削除を停止しました。" }, { status: 409 });
    try {
      const env = getProviderEnv();
      const [hasDns, hasPagesDomain] = await Promise.all([hasCloudflareDnsRecord(domain.fqdn, env), hasAnyPagesCustomDomain(domain.fqdn, domain, env)]);
      if (hasDns || hasPagesDomain) return Response.json({ error: "外部設定が残っているため、安全のため削除を停止しました。" }, { status: 409 });
      await markDomainDeleted(domain.id, cronAuthorized ? "expiry_cron" : "admin");
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: "外部設定の状態を確認できないため、安全のため削除を停止しました。" }, { status: 409 });
    }
  }
  if (domain.provider === "vercel" && !customDomain && !dnsRecord) return Response.json({ error: "このドメインの所有情報が不足しているため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider !== "vercel" && !customDomain && domain.status !== "Draft" && !dnsRecord) return Response.json({ error: "このドメインの所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });
  if (domain.provider === "cloudflare_pages" && domain.status !== "Draft" && !customDomain && !dnsRecord) return Response.json({ error: "外部設定の所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });

  try {
    const env = getProviderEnv();
    if (domain.status !== "Draft") {
      if (domain.provider === "vercel") {
        if (customDomain) {
          const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(domain.providerTargetId)}/domains/${encodeURIComponent(domain.fqdn)}?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` } });
          if (!response.ok) throw new Error("vercel_delete_failed");
          await markManagedResourceDeleted(customDomain.id);
        }
        if (dnsRecord) { await deleteCloudflareDnsRecord(dnsRecord.externalId, env); await markManagedResourceDeleted(dnsRecord.id); }
      } else if (domain.provider === "cloudflare_pages") {
        const pagesSubdomain = await assertPagesProject(domain, env);
        if (!dnsRecord || !(await hasOwnedCloudflareDnsRecord(domain.fqdn, dnsRecord.externalId, pagesSubdomain, env))) return Response.json({ error: "外部設定の状態を確認できないため、安全のため削除を停止しました。" }, { status: 409 });
        // Pages側の削除後にCronが中断しても、次回は「すでに削除済み」と判定してDNS削除へ進める。
        const pagesDomainId = await findPagesCustomDomainId(domain.fqdn, domain, env);
        if (pagesDomainId && (!customDomain || pagesDomainId !== customDomain.externalId)) return Response.json({ error: "外部設定の所有情報が確認できないため、安全のため削除を停止しました。" }, { status: 409 });
        if (pagesDomainId) {
          // Pages APIはFQDN指定の削除のみのため、直前の保存ID照合後に実行する。
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains/${encodeURIComponent(domain.fqdn)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.success) throw new Error("pages_delete_failed");
          if (await hasAnyPagesCustomDomain(domain.fqdn, domain, env)) return Response.json({ error: "Pages側の削除を確認できないため、DNS設定の削除を停止しました。" }, { status: 409 });
          if (customDomain) await markManagedResourceDeleted(customDomain.id);
        } else if (customDomain) {
          // 前回のPages削除は成功済みだが、その後のDNS処理で中断したケース。
          await markManagedResourceDeleted(customDomain.id);
        }
        // CloudflareのDNS削除APIは条件付き削除に対応しないため、削除直前にも再照合する。
        const currentPagesSubdomain = await assertPagesProject(domain, env);
        if (!(await hasOwnedCloudflareDnsRecord(domain.fqdn, dnsRecord.externalId, currentPagesSubdomain, env))) return Response.json({ error: "DNS設定が変更されたため、安全のため削除を停止しました。" }, { status: 409 });
        await deleteCloudflareDnsRecord(dnsRecord.externalId, env);
        await markManagedResourceDeleted(dnsRecord.id);
        if (customDomain) await markManagedResourceDeleted(customDomain.id);
      } else if (domain.provider === "cloudflare_workers") {
        if (customDomain) {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/domains/${encodeURIComponent(domain.fqdn)}`, { method: "DELETE", headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.success) throw new Error("workers_delete_failed");
          await markManagedResourceDeleted(customDomain.id);
        }
      }
    }
    await markDomainDeleted(domain.id, cronAuthorized ? "expiry_cron" : "admin");
    return Response.json({ ok: true });
  } catch {
    if (cronAuthorized) await markDomainDeletionFailed(domain.id);
    return Response.json({ error: "外部サービスの削除に失敗しました。削除失敗として残しています。再試行してください。" }, { status: 502 });
  }
}
