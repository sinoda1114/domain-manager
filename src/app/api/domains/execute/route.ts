import { randomUUID } from "node:crypto";
import { z } from "zod";
import { failExecution, findManagedDomain, finishExecution, isOwnedManagedResource, reserveExecution } from "@/infrastructure/db/domain-repository";
import { isAdmin } from "@/lib/auth";
import { getProviderEnv } from "@/lib/env";
import { listProviderTargets } from "@/infrastructure/providers/targets";
const input = z.object({ domainId: z.string().uuid(), confirmation: z.string().min(1) });

async function preflight(domain: NonNullable<Awaited<ReturnType<typeof findManagedDomain>>>) {
  const env = getProviderEnv();
  const targets = await listProviderTargets();
  if (!targets.some((target) => target.id === domain.providerTargetId && target.provider === domain.provider)) throw new Error("target_missing");
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${encodeURIComponent(domain.fqdn)}`, { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error("dns_check_failed");
  if (Array.isArray(body.result) && body.result.length > 0 && !(await isOwnedManagedResource(domain.id, domain.fqdn))) throw new Error("dns_conflict");
}
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "invalid_input" }, { status: 400 });
  const domain = await findManagedDomain(parsed.data.domainId); if (!domain || parsed.data.confirmation !== `${domain.fqdn} を反映`) return Response.json({ error: "confirmation_required" }, { status: 400 });
  try { await preflight(domain); } catch { return Response.json({ error: "preflight_failed" }, { status: 409 }); }
  const operationId = randomUUID(); if (!(await reserveExecution(domain.id, operationId))) return Response.json({ error: "already_processing" }, { status: 409 });
  try { const env = getProviderEnv(); let externalId = domain.fqdn;
    if (domain.provider === "cloudflare_pages") { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(domain.providerTargetName)}/domains`, { method:"POST",headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({name:domain.fqdn}) }); const b=await r.json(); if(!r.ok||!b.success) throw Error(); externalId=b.result.id; }
    else if (domain.provider === "cloudflare_workers") { const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/domains`,{method:"PUT",headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({hostname:domain.fqdn,service:domain.providerTargetName,zone_id:env.CLOUDFLARE_ZONE_ID})});const b=await r.json();if(!r.ok||!b.success)throw Error();externalId=b.result.id; }
    else { const r=await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(domain.providerTargetId)}/domains?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`,{method:"POST",headers:{Authorization:`Bearer ${env.VERCEL_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({name:domain.fqdn})});const b=await r.json();if(!r.ok)throw Error();externalId=b.name??domain.fqdn; }
    await finishExecution(domain.id,operationId,externalId); return Response.json({ok:true,status:"DNS Pending"});
  } catch { await failExecution(domain.id,operationId); return Response.json({error:"external_execution_failed"},{status:502}); }
}
