import { getProviderEnv } from "@/lib/env";
import { providerSchema } from "@/lib/subdomain";

export type ProviderTarget = {
  id: string;
  name: string;
  provider: "vercel" | "cloudflare_pages" | "cloudflare_workers";
};

type CloudflareResponse<T> = { success: boolean; result: T; errors?: Array<{ message?: string }> };

async function cloudflareJson<T>(path: string): Promise<T> {
  const env = getProviderEnv();
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    cache: "no-store",
  });
  const body = await response.json() as CloudflareResponse<T>;
  if (!response.ok || !body.success) throw new Error(body.errors?.[0]?.message ?? "Cloudflare API request failed.");
  return body.result;
}

/** 管理対象として選べる実在プロジェクト・Workerを、変更なしで取得する。 */
export async function listProviderTargets(): Promise<ProviderTarget[]> {
  const env = getProviderEnv();
  const [pages, workers, vercelResponse] = await Promise.all([
    cloudflareJson<Array<{ id: string; name: string }>>(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects`),
    cloudflareJson<Array<{ id: string }>>(`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`),
    fetch(`https://api.vercel.com/v9/projects?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}&limit=100`, {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
      cache: "no-store",
    }),
  ]);
  const vercel = await vercelResponse.json() as { projects?: Array<{ id: string; name: string }> };
  if (!vercelResponse.ok || !vercel.projects) throw new Error("Vercel API request failed.");

  return [
    ...vercel.projects.map(({ id, name }) => ({ id, name, provider: "vercel" as const })),
    ...pages.map(({ id, name }) => ({ id, name, provider: "cloudflare_pages" as const })),
    ...workers.map(({ id }) => ({ id, name: id, provider: "cloudflare_workers" as const })),
  ];
}

export function ensureProviderTarget(targets: ProviderTarget[], input: { provider: string; targetId: string }): ProviderTarget {
  const provider = providerSchema.parse(input.provider);
  const target = targets.find((candidate) => candidate.provider === provider && candidate.id === input.targetId);
  if (!target) throw new Error("選択した公開先が見つかりません。画面を更新して選び直してください。");
  return target;
}
