import { z } from "zod";

const reservedLabels = new Set([
  "www", "api", "admin", "domains", "mail", "smtp", "imap", "pop", "ftp",
  "cdn", "static", "assets", "status", "support", "help", "docs", "dev", "test",
  "staging", "_acme-challenge",
]);

const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const providerSchema = z.enum(["vercel", "cloudflare_pages", "cloudflare_workers"]);

export const subdomainLabelSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => labelPattern.test(value), "サブドメインは英小文字・数字・ハイフンで入力してください。")
  .refine((value) => !reservedLabels.has(value), "このサブドメインは予約されています。");

export function toFqdn(label: string, rootDomain: string): string {
  return `${label}.${rootDomain.toLowerCase()}`;
}
