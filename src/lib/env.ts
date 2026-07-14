import { z } from "zod";

const serverEnvSchema = z.object({
  ROOT_DOMAIN: z.string().min(1).default("shinodev.com"),
  TURSO_DATABASE_URL: z.url().startsWith("libsql://"),
  TURSO_AUTH_TOKEN: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().startsWith("scrypt$").min(1),
  AUTH_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * 実行時にだけ環境変数を検証する。ビルド時の静的評価では接続情報を要求しない。
 */
export function getServerEnv(): ServerEnv {
  const readRuntimeEnv = (name: keyof ServerEnv) => process.env[name];

  return serverEnvSchema.parse({
    ROOT_DOMAIN: readRuntimeEnv("ROOT_DOMAIN"),
    // 動的キーで参照し、Next.js のビルド時置換ではなく実行環境の値を使う。
    TURSO_DATABASE_URL: readRuntimeEnv("TURSO_DATABASE_URL"),
    TURSO_AUTH_TOKEN: readRuntimeEnv("TURSO_AUTH_TOKEN"),
    ADMIN_PASSWORD_HASH: readRuntimeEnv("ADMIN_PASSWORD_HASH"),
    AUTH_SECRET: readRuntimeEnv("AUTH_SECRET"),
  });
}

const providerEnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CLOUDFLARE_ZONE_ID: z.string().length(32),
  VERCEL_TOKEN: z.string().min(1),
  VERCEL_TEAM_ID: z.string().min(1),
});

export type ProviderEnv = z.infer<typeof providerEnvSchema>;

/** 外部プロバイダーの読み取りに必要な値だけを検証する。 */
export function getProviderEnv(): ProviderEnv {
  const readRuntimeEnv = (name: keyof ProviderEnv) => process.env[name];
  return providerEnvSchema.parse({
    CLOUDFLARE_ACCOUNT_ID: readRuntimeEnv("CLOUDFLARE_ACCOUNT_ID"),
    CLOUDFLARE_API_TOKEN: readRuntimeEnv("CLOUDFLARE_API_TOKEN"),
    CLOUDFLARE_ZONE_ID: readRuntimeEnv("CLOUDFLARE_ZONE_ID"),
    VERCEL_TOKEN: readRuntimeEnv("VERCEL_TOKEN"),
    VERCEL_TEAM_ID: readRuntimeEnv("VERCEL_TEAM_ID"),
  });
}
