import https from "node:https";

export type DomainVerificationStatus = "Active" | "SSL Pending" | "DNS Pending";

async function resolvePublicAddress(hostname: string) {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!response.ok) throw new Error("dns_lookup_failed");
  const body = await response.json() as { Answer?: Array<{ type: number; data: string }> };
  const address = body.Answer?.find((answer) => answer.type === 1)?.data;
  if (!address) throw new Error("dns_not_ready");
  return address;
}

async function verifyHttps(hostname: string, address: string) {
  await new Promise<void>((resolve, reject) => {
    const request = https.request({ hostname: address, port: 443, path: "/", method: "HEAD", servername: hostname, headers: { host: hostname }, timeout: 10_000 }, (response) => {
      response.resume();
      if (response.statusCode && (response.statusCode < 400 || [301, 302, 307, 308].includes(response.statusCode))) resolve();
      else reject(new Error("https_not_ready"));
    });
    request.on("timeout", () => request.destroy(new Error("https_timeout")));
    request.on("error", reject);
    request.end();
  });
}

export async function verifyPublicDomain(hostname: string): Promise<DomainVerificationStatus> {
  try {
    const address = await resolvePublicAddress(hostname);
    await verifyHttps(hostname, address);
    return "Active";
  } catch {
    try { await resolvePublicAddress(hostname); return "SSL Pending"; } catch { return "DNS Pending"; }
  }
}
