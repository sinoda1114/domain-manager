import { randomUUID } from "node:crypto";

import { getDatabaseClient } from "@/infrastructure/db/client";
import { getServerEnv } from "@/lib/env";
import { providerSchema, subdomainLabelSchema, toFqdn } from "@/lib/subdomain";

export type ManagedDomain = {
  id: string;
  label: string;
  fqdn: string;
  provider: "vercel" | "cloudflare_pages" | "cloudflare_workers";
  providerTargetId: string;
  providerTargetName: string;
  status: string;
  lastCheckedAt: string | null;
  deleteAt: string | null;
  createdAt: string;
};

export async function listManagedDomains(): Promise<ManagedDomain[]> {
  const result = await getDatabaseClient().execute({
    sql: `SELECT id, label, fqdn, provider, provider_target_id, provider_target_name, status, last_checked_at, delete_at, created_at
          FROM domains WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    args: [],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    fqdn: String(row.fqdn),
    provider: providerSchema.parse(row.provider),
    providerTargetId: String(row.provider_target_id),
    providerTargetName: String(row.provider_target_name),
    status: String(row.status),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    deleteAt: row.delete_at ? String(row.delete_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function listPendingDomains(): Promise<ManagedDomain[]> {
  const result = await getDatabaseClient().execute({
    sql: `SELECT id, label, fqdn, provider, provider_target_id, provider_target_name, status, last_checked_at, delete_at, created_at
          FROM domains
          WHERE deleted_at IS NULL
            AND status IN ('DNS Pending', 'SSL Pending')
            AND (delete_at IS NULL OR datetime(delete_at) > CURRENT_TIMESTAMP)
          ORDER BY updated_at ASC`,
    args: [],
  });
  return result.rows.map((row) => ({
    id: String(row.id), label: String(row.label), fqdn: String(row.fqdn),
    provider: providerSchema.parse(row.provider), providerTargetId: String(row.provider_target_id),
    providerTargetName: String(row.provider_target_name), status: String(row.status),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null, deleteAt: row.delete_at ? String(row.delete_at) : null, createdAt: String(row.created_at),
  }));
}

export async function findManagedDomain(id: string): Promise<ManagedDomain | undefined> {
  const result = await getDatabaseClient().execute({ sql: `SELECT id, label, fqdn, provider, provider_target_id, provider_target_name, status, last_checked_at, delete_at, created_at FROM domains WHERE id = ? AND deleted_at IS NULL`, args: [id] });
  const row = result.rows[0]; if (!row) return undefined;
  return { id: String(row.id), label: String(row.label), fqdn: String(row.fqdn), provider: providerSchema.parse(row.provider), providerTargetId: String(row.provider_target_id), providerTargetName: String(row.provider_target_name), status: String(row.status), lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null, deleteAt: row.delete_at ? String(row.delete_at) : null, createdAt: String(row.created_at) };
}

export async function listExpiredDomains(): Promise<ManagedDomain[]> {
  const result = await getDatabaseClient().execute({
    sql: `SELECT id, label, fqdn, provider, provider_target_id, provider_target_name, status, last_checked_at, delete_at, created_at
          FROM domains
          WHERE deleted_at IS NULL AND delete_at IS NOT NULL AND datetime(delete_at) <= CURRENT_TIMESTAMP
            AND (
              status IN ('Draft', 'Active', 'DNS Pending', 'SSL Pending', 'Deletion Failed')
              OR (status = 'Deleting' AND datetime(updated_at) <= datetime('now', '-10 minutes'))
            )
          ORDER BY delete_at ASC LIMIT 50`,
    args: [],
  });
  return result.rows.map((row) => ({
    id: String(row.id), label: String(row.label), fqdn: String(row.fqdn), provider: providerSchema.parse(row.provider),
    providerTargetId: String(row.provider_target_id), providerTargetName: String(row.provider_target_name), status: String(row.status),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null, deleteAt: row.delete_at ? String(row.delete_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function claimDomainExpiration(domainId: string): Promise<boolean> {
  const result = await getDatabaseClient().execute({
    sql: `UPDATE domains SET status = 'Deleting', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL AND delete_at IS NOT NULL AND datetime(delete_at) <= CURRENT_TIMESTAMP
            AND (
              status IN ('Draft', 'Active', 'DNS Pending', 'SSL Pending', 'Deletion Failed')
              OR (status = 'Deleting' AND datetime(updated_at) <= datetime('now', '-10 minutes'))
            )`,
    args: [domainId],
  });
  return result.rowsAffected === 1;
}

export async function restoreDomainStatus(domainId: string, status: string): Promise<void> {
  await getDatabaseClient().execute({ sql: "UPDATE domains SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Deleting' AND deleted_at IS NULL", args: [status, domainId] });
}

export async function markDomainDeletionFailed(domainId: string): Promise<void> {
  await getDatabaseClient().execute({ sql: "UPDATE domains SET status = 'Deletion Failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Deleting' AND deleted_at IS NULL", args: [domainId] });
}

export async function updateDomainDeleteAt(domainId: string, deleteAt: string | null): Promise<boolean> {
  const result = await getDatabaseClient().execute({
    sql: "UPDATE domains SET delete_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL AND status NOT IN ('Executing', 'Deleting')",
    args: [deleteAt, domainId],
  });
  return result.rowsAffected === 1;
}

export async function markManagedResourceDeleted(resourceId: string): Promise<void> {
  await getDatabaseClient().execute({ sql: "UPDATE managed_resources SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", args: [resourceId] });
}

export async function markDomainActive(id: string, providerDomainId: string): Promise<void> {
  await getDatabaseClient().execute({ sql: "UPDATE domains SET status = 'Active', provider_domain_id = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Draft'", args: [providerDomainId, id] });
}

export async function reserveExecution(domainId: string, operationId: string): Promise<boolean> {
  const client = getDatabaseClient();
  const results = await client.batch([
    { sql: "UPDATE domains SET status = 'Executing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'Draft'", args: [domainId] },
    { sql: "INSERT INTO operations (id, domain_id, fqdn, type, status, idempotency_key, requested_by) SELECT ?, id, fqdn, 'create', 'running', ?, 'admin' FROM domains WHERE id = ? AND status = 'Executing'", args: [operationId, operationId, domainId] },
    { sql: "INSERT INTO operation_steps (id, operation_id, sequence, name, status, started_at) SELECT ?, ?, 1, 'provider_create', 'running', CURRENT_TIMESTAMP FROM operations WHERE id = ?", args: [randomUUID(), operationId, operationId] },
  ], "write");
  return results[0]?.rowsAffected === 1 && results[1]?.rowsAffected === 1 && results[2]?.rowsAffected === 1;
}

export async function finishExecution(domainId: string, operationId: string, providerDomainId: string, dnsRecordId?: string): Promise<void> {
  const client = getDatabaseClient();
  await client.batch([{ sql: "UPDATE domains SET status = 'DNS Pending', provider_domain_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [providerDomainId, domainId] }, { sql: "UPDATE operations SET status = 'completed', finished_at = CURRENT_TIMESTAMP WHERE id = ?", args: [operationId] }, { sql: "UPDATE operation_steps SET status = 'completed', finished_at = CURRENT_TIMESTAMP, external_resource_id = ? WHERE operation_id = ?", args: [providerDomainId, operationId] }, { sql: "INSERT INTO managed_resources (id, domain_id, provider, resource_type, external_id, external_name, created_by_operation_id, ownership_fingerprint) SELECT ?, id, provider, 'custom_domain', ?, fqdn, ?, ? FROM domains WHERE id = ?", args: [randomUUID(), providerDomainId, operationId, `${domainId}:${providerDomainId}`, domainId] }, { sql: "INSERT INTO managed_resources (id, domain_id, provider, resource_type, external_id, external_name, created_by_operation_id, ownership_fingerprint) SELECT ?, id, 'cloudflare', 'dns_record', ?, fqdn, ?, ? FROM domains WHERE id = ? AND ? <> ''", args: [randomUUID(), dnsRecordId ?? "", operationId, `${domainId}:${dnsRecordId ?? ""}`, domainId, dnsRecordId ?? ""] }], "write");
}

export async function failExecution(domainId: string, operationId: string): Promise<void> { await getDatabaseClient().batch([{ sql: "UPDATE domains SET status = 'Failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [domainId] }, { sql: "UPDATE operations SET status = 'failed', error_code = 'provider_request_failed', finished_at = CURRENT_TIMESTAMP WHERE id = ?", args: [operationId] }, { sql: "UPDATE operation_steps SET status = 'failed', finished_at = CURRENT_TIMESTAMP WHERE operation_id = ?", args: [operationId] }], "write"); }

export async function updateDomainVerification(id: string, status: "Active" | "SSL Pending" | "DNS Pending"): Promise<void> { await getDatabaseClient().execute({ sql: "UPDATE domains SET status = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", args: [status, id] }); }

export async function isOwnedManagedResource(domainId: string, externalName: string): Promise<boolean> {
  const result = await getDatabaseClient().execute({ sql: "SELECT 1 FROM managed_resources WHERE domain_id = ? AND external_name = ? AND deleted_at IS NULL LIMIT 1", args: [domainId, externalName] });
  return result.rows.length > 0;
}

export async function listOwnedManagedResources(domainId: string) {
  const result = await getDatabaseClient().execute({ sql: "SELECT id, provider, resource_type, external_id, external_name, ownership_fingerprint FROM managed_resources WHERE domain_id = ? AND deleted_at IS NULL", args: [domainId] });
  return result.rows.map((row) => ({ id: String(row.id), provider: String(row.provider), resourceType: String(row.resource_type), externalId: String(row.external_id), externalName: String(row.external_name), ownershipFingerprint: String(row.ownership_fingerprint) }));
}

export async function markDomainDeleted(domainId: string, requestedBy = "admin"): Promise<void> {
  const client = getDatabaseClient();
  const domain = await findManagedDomain(domainId);
  if (!domain) throw new Error("domain_not_found");
  const operationId = randomUUID();
  await client.batch([
    { sql: "UPDATE domains SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL", args: [domainId] },
    { sql: "UPDATE managed_resources SET deleted_at = CURRENT_TIMESTAMP WHERE domain_id = ? AND deleted_at IS NULL", args: [domainId] },
    { sql: "INSERT INTO operations (id, domain_id, fqdn, type, status, idempotency_key, requested_by, finished_at) VALUES (?, ?, ?, 'delete', 'completed', ?, ?, CURRENT_TIMESTAMP)", args: [operationId, domainId, domain.fqdn, randomUUID(), requestedBy] },
  ], "write");
}

export async function listOperations() { const result = await getDatabaseClient().execute("SELECT fqdn, type, status, requested_by, started_at, finished_at FROM operations ORDER BY started_at DESC LIMIT 20"); return result.rows.map((row) => ({ fqdn: String(row.fqdn), type: String(row.type), status: String(row.status), requestedBy: String(row.requested_by), startedAt: String(row.started_at), finishedAt: row.finished_at ? String(row.finished_at) : null })); }

/**
 * 外部プロバイダーを変更しない安全な下書き作成。実際の登録はPlan検証後のユースケースでのみ行う。
 */
export async function createDraftDomain(input: {
  label: string;
  provider: string;
  providerTargetId: string;
  providerTargetName: string;
  deleteAt?: string | null;
  requestedBy: string;
}): Promise<ManagedDomain> {
  const label = subdomainLabelSchema.parse(input.label);
  const provider = providerSchema.parse(input.provider);
  const fqdn = toFqdn(label, getServerEnv().ROOT_DOMAIN);
  const deleteAt = input.deleteAt ?? null;
  if (deleteAt) {
    const deleteAtMs = Date.parse(deleteAt);
    if (!Number.isFinite(deleteAtMs) || deleteAtMs <= Date.now()) throw new Error("invalid_delete_at");
  }
  const id = randomUUID();
  const client = getDatabaseClient();

  await client.execute({
    sql: `INSERT INTO domains (id, label, fqdn, provider, provider_target_id, provider_target_name, status, delete_at)
          VALUES (?, ?, ?, ?, ?, ?, 'Draft', ?)`,
    args: [id, label, fqdn, provider, input.providerTargetId, input.providerTargetName, deleteAt],
  });

  await client.execute({
    sql: `INSERT INTO operations (id, domain_id, fqdn, type, status, idempotency_key, requested_by)
          VALUES (?, ?, ?, 'create', 'completed', ?, ?)`,
    args: [randomUUID(), id, fqdn, randomUUID(), input.requestedBy],
  });

  const domains = await listManagedDomains();
  const created = domains.find((domain) => domain.id === id);
  if (!created) throw new Error("Draft domain was not persisted.");
  return created;
}
