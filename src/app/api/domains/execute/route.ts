import { randomUUID } from "node:crypto";
import { z } from "zod";

import { failExecution, findManagedDomain, finishExecution, isOwnedManagedResource, reserveExecution, updateDomainVerification } from "@/infrastructure/db/domain-repository";
import { listProviderTargets } from "@/infrastructure/providers/targets";
import { isAdmin } from "@/lib/auth";
import { getProviderEnv } from "@/lib/env";
import { verifyPublicDomain } from "@/lib/domain-verification";

const input = z.object({ domainId: z.string().uuid(), confirmation: z.string().min(1) });
const vercelCnameTarget = "cname.vercel-dns.com";

type ProviderEnv = ReturnType<typeof getProviderEnv>;

async function createCloudflareDnsRecord(fqdn: string, target: string, env: ProviderEnv, proxied: boolean) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ type: "CNAME", name: fqdn, content: target, ttl: 1, proxied }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success || !body.result?.id) throw new Error("dns_create_failed");
  return String(body.result.id);
}

async function deleteCloudflareDnsRecord(recordId: string, env: ProviderEnv) {
  await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
  }).catch(() => undefined);
}

async function getPagesProjectSubdomain(projectName: string, env: ProviderEnv) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(projectName)}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  const subdomain = body.result?.subdomain;
  if (!response.ok || !body.success || typeof subdomain !== "string" || !subdomain) throw new Error("pages_project_missing");
  return subdomain;
}

async function preflight(domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>) {
  const env = getProviderEnv();
  const targets = await listProviderTargets();
  const target = targets.find((candidate) => candidate.id === domain.providerTargetId && candidate.provider === domain.provider);
  if (!target || target.name !== domain.providerTargetName) throw new Error("target_changed");
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${encodeURIComponent(domain.fqdn)}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error("dns_check_failed");
  if (Array.isArray(body.result) && body.result.length > 0 && !(await isOwnedManagedResource(domain.id, domain.fqdn))) throw new Error("dns_conflict");
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });

  const domain = await findManagedDomain(parsed.data.domainId);
  if (!domain || parsed.data.confirmation !== `${domain.fqdn} を反映`) return Response.json({ error: "確認文が一致しません。表示されたFQDNをそのまま入力してください。" }, { status: 400 });
  try { await preflight(domain); } catch { return Response.json({ error: "外部サービスの事前確認に失敗しました。状態を確認して再試行してください。" }, { status: 409 }); }

  const operationId = randomUUID();
  if (!(await reserveExecution(domain.id, operationId))) return Response.json({ error: "このドメインは別の操作が進行中です。しばらく待ってください。" }, { status: 409 });

  let createdDnsRecordId = "";
  try {
    const env = getProviderEnv();
    let externalId = domain.fqdn;

    if (domain.provider === "vercel") {
      createdDnsRecordId = await createCloudflareDnsRecord(domain.fqdn, vercelCnameTarget, env, false);
      const response = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(domain.providerTargetId)}/domains?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, {
        method: "POST", headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ name: domain.fqdn }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("vercel_domain_create_failed");
      externalId = body.name ?? domain.fqdn;
    } else if (domain.provider === "cloudflare_pages") {
      const pagesSubdomain = await getPagesProjectSubdomain(domain.providerTargetName, env);
      // PagesはCloudflare Access/WAFを通すため、ゾーンのプロキシを有効にする。
      createdDnsRecordId = await createCloudflareDnsRecord(domain.fqdn, pagesSubdomain, env, true);
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ name: domain.fqdn }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error("pages_domain_create_failed");
      externalId = body.result?.id ?? domain.fqdn;
    } else {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ hostname: domain.fqdn, service: domain.providerTargetName, zone_id: env.CLOUDFLARE_ZONE_ID }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error("workers_domain_create_failed");
      externalId = body.result?.id ?? domain.fqdn;
    }

    await finishExecution(domain.id, operationId, externalId, createdDnsRecordId);
    const status = await verifyPublicDomain(domain.fqdn);
    if (status === "Active") await updateDomainVerification(domain.id, status);
    return Response.json({ ok: true, status });
  } catch {
    if (createdDnsRecordId) await deleteCloudflareDnsRecord(createdDnsRecordId, getProviderEnv());
    await failExecution(domain.id, operationId);
    return Response.json({ error: "外部サービスへの反映に失敗しました。下書きは失敗状態で残っています。" }, { status: 502 });
  }
}
