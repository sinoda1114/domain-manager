"use client";

import { useMemo, useState } from "react";

import { DeleteDomainButton } from "@/components/delete-domain-button";
import { DomainNameEditor } from "@/components/domain-name-editor";
import { DomainScheduleEditor } from "@/components/domain-schedule-editor";
import { DomainVerificationProgress } from "@/components/domain-verification-progress";
import { ExecuteDomainButton } from "@/components/execute-domain-button";
import { RefreshDomainButton } from "@/components/refresh-domain-button";
import type { ManagedDomain } from "@/infrastructure/db/domain-repository";
import type { ProviderTarget } from "@/infrastructure/providers/targets";

const statusClass: Record<string, string> = { Active: "status-active", "SSL Pending": "status-pending", "DNS Pending": "status-pending", Draft: "status-draft", Executing: "status-progress", Deleting: "status-progress", Failed: "status-failed", "Deletion Failed": "status-failed" };
const statusLabel: Record<string, string> = { Active: "公開中", "SSL Pending": "反映確認中（SSL）", "DNS Pending": "反映確認中（DNS）", Draft: "準備中", Executing: "反映中", Deleting: "削除中", Failed: "反映失敗", "Deletion Failed": "削除失敗" };
const providerName = { vercel: "Vercel", cloudflare_pages: "Cloudflare Pages", cloudflare_workers: "Cloudflare Workers" };

export function DomainManagementList({ domains, targets, serviceHostname, serviceUrl }: { domains: ManagedDomain[]; targets: ProviderTarget[]; serviceHostname: string; serviceUrl: string }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDomains = useMemo(() => domains.filter((domain) => !normalizedQuery || [domain.fqdn, domain.displayName, domain.providerTargetName, providerName[domain.provider]].filter(Boolean).some((value) => value?.toLowerCase().includes(normalizedQuery))), [domains, normalizedQuery]);
  const sourceUrlFor = (domain: ManagedDomain) => targets.find((target) => target.provider === domain.provider && target.id === domain.providerTargetId)?.sourceUrl;

  return <section className="section" id="domains"><div className="section-heading"><div><h2>サブドメインを管理</h2><p className="section-description">サービス名、管理対象のURL、公開状態、自動削除日時を確認・変更できます。</p></div><span>{domains.length + 1}件</span></div><div className="management-search"><label htmlFor="domain-search">管理中のサブドメインを検索</label><div className="search-field"><input id="domain-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="サービス名、サブドメイン、公開先で検索" />{query && <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="検索語を消去">×</button>}</div></div><div className="records" role="table"><div className="record record-head" role="row"><span>サブドメイン</span><span>公開先</span><span>状態</span><span>確認・操作</span></div><div className="record record-system" role="row"><div className="domain-cell"><a href={serviceUrl} target="_blank" rel="noreferrer" className="domain-link"><strong>{serviceHostname}</strong><i className="external-mark" aria-hidden="true">↗</i></a><small>この管理サービス</small></div><div className="target-cell"><span>Domain Manager</span><small>システム管理</small></div><span className="status status-active">公開中</span><div className="record-action"><span className="system-managed-label">システム管理</span></div></div>{filteredDomains.map((domain) => <div className="record" role="row" key={domain.id}><div className="domain-cell"><a href={`https://${domain.fqdn}`} target="_blank" rel="noreferrer" className="domain-link"><strong>{domain.fqdn}</strong><i className="external-mark" aria-hidden="true">↗</i></a><DomainNameEditor domainId={domain.id} displayName={domain.displayName} disabled={["Executing", "Deleting"].includes(domain.status)} /><small>{domain.lastCheckedAt ? `最終確認 ${domain.lastCheckedAt}` : "未確認"}</small><DomainScheduleEditor domainId={domain.id} deleteAt={domain.deleteAt} disabled={["Executing", "Deleting"].includes(domain.status)} /></div><div className="target-cell"><span>{providerName[domain.provider]}</span><small>{domain.providerTargetName}</small>{sourceUrlFor(domain) && <a className="source-link" href={sourceUrlFor(domain)} target="_blank" rel="noreferrer">実体URL ↗</a>}</div>{domain.status === "DNS Pending" || domain.status === "SSL Pending" ? <DomainVerificationProgress domainId={domain.id} status={domain.status} /> : <span className={`status ${statusClass[domain.status] ?? "status-progress"}`}>{statusLabel[domain.status] ?? domain.status}</span>}<div className="record-action">{domain.status === "Draft" ? <ExecuteDomainButton domainId={domain.id} fqdn={domain.fqdn} /> : ["DNS Pending", "SSL Pending"].includes(domain.status) ? <RefreshDomainButton domainId={domain.id} /> : null}<DeleteDomainButton domainId={domain.id} fqdn={domain.fqdn} /></div></div>)}{filteredDomains.length === 0 && <p className="search-empty">一致する管理対象はありません。</p>}</div></section>;
}
