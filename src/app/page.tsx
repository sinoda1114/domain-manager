import { DomainRegistration } from "@/components/domain-registration";
import { DomainManagementList } from "@/components/domain-management-list";
import { LogoutButton } from "@/components/logout-button";
import { listManagedDomains, listOperations } from "@/infrastructure/db/domain-repository";
import { listProviderTargets } from "@/infrastructure/providers/targets";
import { isAdmin } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function Home() {
  const signedIn = await isAdmin();
  if (!signedIn) redirect("/login");
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
    <header className="masthead"><a className="wordmark" href="#overview"><Image className="wordmark-icon" src="/icon.svg" alt="" width={30} height={30} priority />Domain Manager</a><nav aria-label="主なメニュー">{hasManagedDomains && <a href="#domains"><i className="ui-icon icon-domains" />サブドメイン</a>}{hasManagedDomains && <a href="#operations"><i className="ui-icon icon-history" />履歴</a>}</nav>{signedIn && <div><i className="connection-dot" />接続済み <LogoutButton /></div>}</header>
    <div className="registry" id="overview">
      <section className="page-hero"><div><h1>{hasManagedDomains ? "サブドメイン" : "サブドメインを追加"}</h1></div><div className="hero-state"><span><i className="ui-icon icon-globe" />管理ゾーン</span><b>{rootDomain}</b><dl><div><dt>管理中</dt><dd>{managedDomainCount}</dd></div><div><dt>公開中</dt><dd>{activeCount}</dd></div><div><dt>確認待ち</dt><dd>{pendingCount}</dd></div></dl></div></section>
      {hasManagedDomains && <DomainManagementList domains={domains} targets={targets} serviceHostname={serviceHostname} serviceUrl={serviceUrl} />}
      <DomainRegistration rootDomain={rootDomain} targets={targets} compact={!hasManagedDomains} />
      {hasManagedDomains && <section className="section history-section" id="operations"><div className="section-heading"><h2>操作履歴</h2></div><div className="history-list">{operations.length === 0 ? <p>まだ履歴はありません。</p> : operations.slice(0, 6).map((operation) => <div className="history-item" key={`${operation.fqdn}-${operation.startedAt}`}><time>{operation.startedAt}</time><b>{operation.fqdn}</b><span>{operation.type}</span><span>{operation.status}</span></div>)}</div></section>}
    </div>
  </main>;
}
