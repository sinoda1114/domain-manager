import { DomainRegistration } from "@/components/domain-registration";

const domains = [
  { fqdn: "degunavi.shinodev.com", provider: "Vercel", target: "degunavi", status: "Active", checkedAt: "2分前" },
  { fqdn: "matchfabo.shinodev.com", provider: "Cloudflare Pages", target: "matchfabo", status: "SSL Pending", checkedAt: "8分前" },
  { fqdn: "keiri.shinodev.com", provider: "Cloudflare Workers", target: "keiri-api", status: "DNS Pending", checkedAt: "15分前" },
];

const statusClass: Record<string, string> = {
  Active: "status-active",
  "SSL Pending": "status-pending",
  "DNS Pending": "status-waiting",
};

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="ShinoDev Domain Manager ホーム">
          <span className="brand-mark">S</span>
          <span>ShinoDev <b>Domain Manager</b></span>
        </a>
        <div className="connection"><span className="pulse" />Cloudflare・Vercel 接続確認済み</div>
        <button className="user-button" type="button">管理者 <span>⌄</span></button>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="主なメニュー">
          <p className="nav-label">WORKSPACE</p>
          <a className="nav-item active" href="#overview"><span>◈</span>概要</a>
          <a className="nav-item" href="#domains"><span>◎</span>ドメイン <em>3</em></a>
          <a className="nav-item" href="#register"><span>＋</span>新規登録</a>
          <a className="nav-item" href="#operations"><span>≡</span>操作履歴</a>
          <p className="nav-label settings-label">SYSTEM</p>
          <a className="nav-item" href="#settings"><span>◌</span>接続設定</a>
          <div className="zone-card"><span>ZONE</span><strong>shinodev.com</strong><small>Cloudflare DNS</small></div>
        </aside>

        <section className="content" id="overview">
          <div className="page-heading">
            <div><p className="eyebrow">DOMAIN CONTROL PLANE</p><h1>公開先を、迷わずつなぐ。</h1><p className="subhead">DNSとホスティングの設定をひとつの計画として管理します。</p></div>
            <a className="primary-link" href="#register">サブドメインを登録 <span>→</span></a>
          </div>

          <section className="metrics" aria-label="ドメインの状態">
            <div className="metric"><span>管理ドメイン</span><strong>3</strong><small>すべて shinodev.com 配下</small></div>
            <div className="metric"><span>公開中</span><strong>1</strong><small className="positive">● HTTPS 応答確認済み</small></div>
            <div className="metric"><span>確認待ち</span><strong>2</strong><small>DNS・証明書を追跡中</small></div>
            <div className="metric accent"><span>次の操作</span><strong>状態を確認</strong><a href="#domains">保留中の2件を見る →</a></div>
          </section>

          <section className="panel table-panel" id="domains">
            <div className="panel-heading"><div><p className="eyebrow">MANAGED DOMAINS</p><h2>ドメイン一覧</h2></div><a href="#register">すべて表示 →</a></div>
            <div className="domain-table" role="table" aria-label="管理中ドメイン">
              <div className="table-row table-header" role="row"><span>FQDN</span><span>配置先</span><span>状態</span><span>最終確認</span></div>
              {domains.map((domain) => <div className="table-row" role="row" key={domain.fqdn}>
                <div><strong>{domain.fqdn}</strong><small>{domain.target}</small></div><span>{domain.provider}</span><span className={`status ${statusClass[domain.status]}`}>{domain.status}</span><span className="checked">{domain.checkedAt}</span>
              </div>)}
            </div>
          </section>

          <DomainRegistration />
        </section>
      </div>
    </main>
  );
}
