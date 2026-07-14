import { DomainRegistration } from "@/components/domain-registration";
import { ExecuteDomainButton } from "@/components/execute-domain-button";
import { RefreshDomainButton } from "@/components/refresh-domain-button";
import { LogoutButton } from "@/components/logout-button";
import { listManagedDomains } from "@/infrastructure/db/domain-repository";
import { listOperations } from "@/infrastructure/db/domain-repository";
import { listProviderTargets } from "@/infrastructure/providers/targets";
import { requireAdmin } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

const statusClass: Record<string, string> = {
  Active: "status-active",
  "SSL Pending": "status-pending",
  "DNS Pending": "status-waiting",
  Draft: "status-draft",
  Executing: "status-waiting",
  Failed: "status-failed",
};

const providerName = { vercel: "Vercel", cloudflare_pages: "Cloudflare Pages", cloudflare_workers: "Cloudflare Workers" };

export default async function Home() {
  await requireAdmin();
  const [domains, targets, operations] = await Promise.all([listManagedDomains(), listProviderTargets(), listOperations()]);
  const activeCount = domains.filter((domain) => domain.status === "Active").length;
  const pendingCount = domains.length - activeCount;
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="ShinoDev Domain Manager ホーム">
          <span className="brand-mark">S</span>
          <span>ShinoDev <b>Domain Manager</b></span>
        </a>
        <div className="connection"><span className="pulse" />Cloudflare・Vercel 接続確認済み</div>
        <LogoutButton />
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="主なメニュー">
          <p className="nav-label">WORKSPACE</p>
          <a className="nav-item active" href="#overview"><span>◈</span>概要</a>
          <a className="nav-item" href="#domains"><span>◎</span>ドメイン <em>{domains.length}</em></a>
          <a className="nav-item" href="#register"><span>＋</span>新規登録</a>
          <a className="nav-item" href="#operations"><span>≡</span>操作履歴</a>
          <p className="nav-label settings-label">SYSTEM</p>
          <a className="nav-item" href="#settings"><span>◌</span>接続設定</a>
          <div className="zone-card"><span>ZONE</span><strong>shinodev.com</strong><small>Cloudflare DNS</small></div>
        </aside>

        <section className="content" id="overview">
          <div className="page-heading">
            <div><p className="eyebrow">DOMAIN OPERATIONS</p><h1>ドメインの状態を、ひと目で。</h1><p className="subhead">DNS・公開先・確認状況を、変更履歴と一緒に管理します。</p></div>
            <a className="primary-link" href="#register">サブドメインを登録 <span>→</span></a>
          </div>

          <section className="metrics" aria-label="ドメインの状態">
            <div className="metric"><span>管理ドメイン</span><strong>{domains.length}</strong><small>すべて shinodev.com 配下</small></div>
            <div className="metric"><span>公開中</span><strong>{activeCount}</strong><small className="positive">● HTTPS 応答確認済み</small></div>
            <div className="metric"><span>確認待ち</span><strong>{pendingCount}</strong><small>DNS・証明書を追跡中</small></div>
            <div className="metric accent"><span>次の操作</span><strong>状態を確認</strong><a href="#domains">保留中の{pendingCount}件を見る →</a></div>
          </section>

          <section className="panel table-panel" id="domains">
            <div className="panel-heading"><div><p className="eyebrow">MANAGED DOMAINS</p><h2>ドメイン一覧</h2></div><a href="#register">すべて表示 →</a></div>
            <div className="domain-table" role="table" aria-label="管理中ドメイン">
              <div className="table-row table-header" role="row"><span>FQDN</span><span>配置先</span><span>状態</span><span>最終確認</span></div>
              {domains.length === 0 ? <div className="table-row" role="row"><div><strong>まだ登録済みドメインはありません</strong><small>新規登録から安全な実行計画を作成してください。</small></div><span>—</span><span>—</span><span className="checked">—</span></div> : domains.map((domain) => <div className="table-row" role="row" key={domain.fqdn}>
                <div><strong>{domain.fqdn}</strong><small>{domain.providerTargetName}</small></div><span>{providerName[domain.provider]}</span><span className={`status ${statusClass[domain.status] ?? "status-waiting"}`}>{domain.status}</span><span className="checked">{domain.status === "Draft" ? <ExecuteDomainButton domainId={domain.id} fqdn={domain.fqdn} /> : <><RefreshDomainButton domainId={domain.id} /><small>{domain.lastCheckedAt ?? "未確認"}</small></>}</span>
              </div>)}
            </div>
          </section>

          <section className="panel table-panel" id="operations"><div className="panel-heading"><div><p className="eyebrow">AUDIT LOG</p><h2>操作履歴</h2></div></div><div className="domain-table">{operations.length===0?<p className="checked">まだ操作履歴はありません。</p>:operations.map((operation)=><div className="table-row" key={`${operation.fqdn}-${operation.startedAt}`}><strong>{operation.fqdn}</strong><span>{operation.type}</span><span>{operation.status}</span><span className="checked">{operation.startedAt}</span></div>)}</div></section>

          <DomainRegistration rootDomain={getServerEnv().ROOT_DOMAIN} targets={targets} />
        </section>
      </div>
    </main>
  );
}
