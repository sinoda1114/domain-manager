import { DomainRegistration } from "@/components/domain-registration";
import { ExecuteDomainButton } from "@/components/execute-domain-button";
import { RefreshDomainButton } from "@/components/refresh-domain-button";
import { DeleteDomainButton } from "@/components/delete-domain-button";
import { DomainVerificationProgress } from "@/components/domain-verification-progress";
import { LogoutButton } from "@/components/logout-button";
import { listManagedDomains, listOperations } from "@/infrastructure/db/domain-repository";
import { listProviderTargets } from "@/infrastructure/providers/targets";
import { requireAdmin } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import Image from "next/image";

const statusClass: Record<string, string> = { Active: "status-active", "SSL Pending": "status-pending", "DNS Pending": "status-pending", Draft: "status-draft", Executing: "status-progress", Failed: "status-failed" };
const statusLabel: Record<string, string> = { Active: "公開中", "SSL Pending": "反映確認中（SSL）", "DNS Pending": "反映確認中（DNS）", Draft: "準備中", Executing: "反映中", Failed: "反映失敗" };
const providerName = { vercel: "Vercel", cloudflare_pages: "Cloudflare Pages", cloudflare_workers: "Cloudflare Workers" };

function sourceUrlFor(targets: Awaited<ReturnType<typeof listProviderTargets>>, provider: string, targetId: string) {
  return targets.find((target) => target.provider === provider && target.id === targetId)?.sourceUrl;
}

export default async function Home() {
  await requireAdmin();
  const rootDomain = getServerEnv().ROOT_DOMAIN;
  const serviceHostname = `domains.${rootDomain}`;
  const serviceUrl = `https://${serviceHostname}`;
  const domains = await listManagedDomains();
  const [targetsResult, operationsResult] = await Promise.allSettled([listProviderTargets(), listOperations()]);
  const targets = targetsResult.status === "fulfilled" ? targetsResult.value : [];
  const operations = operationsResult.status === "fulfilled" ? operationsResult.value : [];
  const managedDomainCount = domains.length + 1;
  const activeCount = domains.filter((domain) => domain.status === "Active").length + 1;
  const pendingCount = managedDomainCount - activeCount;
  const hasManagedDomains = managedDomainCount > 0;

  return <main className="app-shell">
    <header className="masthead"><a className="wordmark" href="#overview"><Image className="wordmark-icon" src="/icon.svg" alt="" width={30} height={30} priority />Domain Manager</a><nav aria-label="主なメニュー">{hasManagedDomains && <a href="#domains"><i className="ui-icon icon-domains" />ドメイン</a>}{hasManagedDomains && <a href="#operations"><i className="ui-icon icon-history" />履歴</a>}</nav><div><i className="connection-dot" />接続済み <LogoutButton /></div></header>
    <div className="registry" id="overview">
      <section className="page-hero"><div><h1>{hasManagedDomains ? "ドメイン" : "サブドメインを追加"}</h1></div><div className="hero-state"><span><i className="ui-icon icon-globe" />管理ゾーン</span><b>{rootDomain}</b><dl><div><dt>管理中</dt><dd>{managedDomainCount}</dd></div><div><dt>公開中</dt><dd>{activeCount}</dd></div><div><dt>確認待ち</dt><dd>{pendingCount}</dd></div></dl></div></section>
      {hasManagedDomains && <section className="section" id="domains"><div className="section-heading"><div><h2>ドメインを管理</h2><p className="section-description">管理対象のURLを確認できます。外部サービスへ反映したドメインは削除できます。</p></div><span>{managedDomainCount}件</span></div><div className="records" role="table"><div className="record record-head" role="row"><span>ドメイン</span><span>公開先</span><span>状態</span><span>確認・操作</span></div><div className="record record-system" role="row"><div className="domain-cell"><a href={serviceUrl} target="_blank" rel="noreferrer" className="domain-link"><strong>{serviceHostname}</strong><i className="external-mark" aria-hidden="true">↗</i></a><small>この管理サービス</small></div><div className="target-cell"><span>Domain Manager</span><small>システム管理</small></div><span className="status status-active">公開中</span><div className="record-action"><span className="system-managed-label">システム管理</span></div></div>{domains.map((domain) => <div className="record" role="row" key={domain.id}><div className="domain-cell"><a href={`https://${domain.fqdn}`} target="_blank" rel="noreferrer" className="domain-link"><strong>{domain.fqdn}</strong><i className="external-mark" aria-hidden="true">↗</i></a><small>{domain.lastCheckedAt ? `最終確認 ${domain.lastCheckedAt}` : "未確認"}</small></div><div className="target-cell"><span>{providerName[domain.provider]}</span><small>{domain.providerTargetName}</small>{sourceUrlFor(targets, domain.provider, domain.providerTargetId) && <a className="source-link" href={sourceUrlFor(targets, domain.provider, domain.providerTargetId)} target="_blank" rel="noreferrer">実体URL ↗</a>}</div>{domain.status === "DNS Pending" || domain.status === "SSL Pending" ? <DomainVerificationProgress domainId={domain.id} status={domain.status} /> : <span className={`status ${statusClass[domain.status] ?? "status-progress"}`}>{statusLabel[domain.status] ?? domain.status}</span>}<div className="record-action">{domain.status === "Draft" ? <ExecuteDomainButton domainId={domain.id} fqdn={domain.fqdn} /> : ["DNS Pending", "SSL Pending"].includes(domain.status) ? <RefreshDomainButton domainId={domain.id} /> : null}<DeleteDomainButton domainId={domain.id} fqdn={domain.fqdn} /></div></div>)}</div></section>}
      <DomainRegistration rootDomain={rootDomain} targets={targets} compact={!hasManagedDomains} />
      {hasManagedDomains && <section className="section history-section" id="operations"><div className="section-heading"><h2>操作履歴</h2></div><div className="history-list">{operations.length === 0 ? <p>まだ履歴はありません。</p> : operations.slice(0, 6).map((operation) => <div className="history-item" key={`${operation.fqdn}-${operation.startedAt}`}><time>{operation.startedAt}</time><b>{operation.fqdn}</b><span>{operation.type}</span><span>{operation.status}</span></div>)}</div></section>}
    </div>
  </main>;
}
