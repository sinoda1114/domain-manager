type GitHubContent = { name: string; type: "file" | "dir"; path: string; content?: string; encoding?: string };

export type RepositoryContext = {
  source: "github" | "metadata-only";
  readme?: string;
  packageManifest?: string;
  rootEntries?: string[];
};

const contextCache = new Map<string, { expiresAt: number; value: RepositoryContext }>();
const GITHUB_TIMEOUT_MS = 2_500;

function parseRepositoryName(repositoryName: string) {
  const match = repositoryName.trim().match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

async function githubJson<T>(url: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

function decodeGitHubText(content: GitHubContent | null) {
  if (!content?.content || content.encoding !== "base64") return "";
  return Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8").slice(0, 8_000);
}

/** 命名に必要な公開情報だけを読み込む。コード・秘密ファイルは取得しない。 */
export async function loadRepositoryContext(repositoryName?: string): Promise<RepositoryContext> {
  if (!repositoryName) return { source: "metadata-only" };
  const parsed = parseRepositoryName(repositoryName);
  if (!parsed) return { source: "metadata-only" };
  const cacheKey = `${parsed.owner}/${parsed.repo}`;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const base = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const root = await githubJson<GitHubContent[]>(`${base}/contents`);
  if (!root) return { source: "metadata-only" };

  const rootEntries = root.filter((entry) => entry.type === "dir" || /^(README(?:\.md)?|package\.json|pnpm-workspace\.yaml|turbo\.json|next\.config\.[cm]?[jt]s)$/.test(entry.name)).map((entry) => `${entry.type === "dir" ? "dir" : "file"}:${entry.name}`).slice(0, 80);
  const readmeEntry = root.find((entry) => entry.type === "file" && /^README(?:\.md)?$/i.test(entry.name));
  const packageEntry = root.find((entry) => entry.type === "file" && entry.name === "package.json");
  const [readme, packageManifest] = await Promise.all([
    readmeEntry ? githubJson<GitHubContent>(`${base}/contents/${encodeURIComponent(readmeEntry.path)}`).then(decodeGitHubText) : Promise.resolve(""),
    packageEntry ? githubJson<GitHubContent>(`${base}/contents/${encodeURIComponent(packageEntry.path)}`).then(decodeGitHubText) : Promise.resolve(""),
  ]);
  const value = { source: "github" as const, rootEntries, readme: readme || undefined, packageManifest: packageManifest || undefined };
  contextCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, value });
  return value;
}
