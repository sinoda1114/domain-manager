import { claimDomainExpiration, listExpiredDomains, listPendingDomains, markDomainDeleted, markDomainDeletionFailed, updateDomainVerification } from "@/infrastructure/db/domain-repository";
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
  const expired = await listExpiredDomains();
  const deletionResults = await Promise.allSettled(expired.map(async (domain) => {
    if (!(await claimDomainExpiration(domain.id))) return { fqdn: domain.fqdn, status: "already_processing" };
    try {
      if (domain.status === "Draft") {
        await markDomainDeleted(domain.id, "expiry_cron");
        return { fqdn: domain.fqdn, status: "deleted" };
      }
      const deleteUrl = new URL("/api/domains/delete", request.url);
      const response = await fetch(deleteUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify({ domainId: domain.id, confirmation: `${domain.fqdn}を削除` }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`expiry_delete_failed:${response.status}`);
      return { fqdn: domain.fqdn, status: "deleted" };
    } catch (error) {
      await markDomainDeletionFailed(domain.id);
      throw error;
    }
  }));
  const checked = results.filter((result) => result.status === "fulfilled").length;
  const deleted = deletionResults.filter((result) => result.status === "fulfilled" && result.value.status === "deleted").length;
  return Response.json({ ok: true, checked, pending: domains.length - checked, expired: expired.length, deleted });
}
