import https from "node:https";

export type DomainVerificationStatus = "Active" | "SSL Pending" | "DNS Pending";

async function resolvePublicAddress(hostname: string) {
  // Validate hostname format and prevent SSRF attacks
  const hostnamePattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!hostnamePattern.test(hostname) || hostname.includes("..") || hostname.length > 253) {
    throw new Error("invalid_hostname");
  }
  // Block access to internal/private IP ranges and cloud metadata endpoints
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\.169\.254$/, // AWS/GCP metadata
    /metadata\.google\.internal$/i,
  ];
  if (blockedPatterns.some(pattern => pattern.test(hostname))) {
    throw new Error("blocked_hostname");
  }
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!response.ok) throw new Error("dns_lookup_failed");
  const body = await response.json() as { Answer?: Array<{ type: number; data: string }> };
  const address = body.Answer?.find((answer) => answer.type === 1)?.data;
  if (!address) throw new Error("dns_not_ready");
  return address;
}

async function verifyHttps(hostname: string, address: string) {
  // Validate IP address is not in private/internal ranges
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^224\./,
    /^240\./,
  ];
  if (privateRanges.some(pattern => pattern.test(address))) {
    throw new Error("private_ip_blocked");
  }
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
