import { listPendingDomains, updateDomainVerification } from "@/infrastructure/db/domain-repository";
import { verifyPublicDomain } from "@/lib/domain-verification";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const domains = await listPendingDomains();
  const results = await Promise.allSettled(domains.map(async (domain) => {
    const status = await verifyPublicDomain(domain.fqdn);
    await updateDomainVerification(domain.id, status);
    return { fqdn: domain.fqdn, status };
  }));
  const checked = results.filter((result) => result.status === "fulfilled").length;
  return Response.json({ ok: true, checked, pending: domains.length - checked });
}
