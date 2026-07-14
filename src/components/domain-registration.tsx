"use client";

import { useMemo, useState } from "react";

const reserved = new Set(["www", "api", "admin", "domains", "mail", "smtp", "imap", "pop", "ftp", "cdn", "static", "assets", "status", "support", "help", "docs", "dev", "test", "staging", "_acme-challenge"]);
const targets = { Vercel: ["degunavi", "matchfabo", "keiri"], "Cloudflare Pages": ["landing", "portal"], "Cloudflare Workers": ["keiri-api", "webhook-router"] };
type Provider = keyof typeof targets;

function validationMessage(label: string) {
  if (!label) return "";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return "英小文字・数字・ハイフンのみ、先頭と末尾のハイフンは使用できません。";
  if (reserved.has(label)) return "この名前はシステム予約語のため使用できません。";
  return "";
}

export function DomainRegistration() {
  const [label, setLabel] = useState("sample");
  const [provider, setProvider] = useState<Provider>("Vercel");
  const [target, setTarget] = useState(targets.Vercel[0]);
  const [planned, setPlanned] = useState(false);
  const error = useMemo(() => validationMessage(label), [label]);
  const fqdn = `${label || "…"}.shinodev.com`;
  const changeProvider = (value: Provider) => { setProvider(value); setTarget(targets[value][0]); setPlanned(false); };

  return <section className="panel registration" id="register">
    <div className="panel-heading"><div><p className="eyebrow">NEW ALLOCATION</p><h2>サブドメインを登録</h2></div><span className="dry-run">変更前に必ず計画を確認します</span></div>
    <div className="register-grid">
      <div className="form-area">
        <div className="form-row"><div className="field"><label htmlFor="label">サブドメイン</label><input id="label" value={label} onChange={(event) => { setLabel(event.target.value.toLowerCase()); setPlanned(false); }} placeholder="例: degunavi" /><span className="hint">{fqdn}</span></div><div className="field"><label htmlFor="provider">配置先</label><select id="provider" value={provider} onChange={(event) => changeProvider(event.target.value as Provider)}>{Object.keys(targets).map((item) => <option key={item}>{item}</option>)}</select><span className="hint">対象の種類に応じて安全な手順を選択</span></div></div>
        {error && <p className="validation">{error}</p>}
        <div className="field"><label htmlFor="target">対象プロジェクト / Worker</label><select id="target" value={target} onChange={(event) => { setTarget(event.target.value); setPlanned(false); }}>{targets[provider].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="form-actions"><span className="dry-run">ドライランでは外部リソースを変更しません。</span><button className="plan-button" type="button" disabled={Boolean(error)} onClick={() => setPlanned(true)}>実行計画を作成 →</button></div>
      </div>
      <aside className="plan" aria-live="polite"><h3>{planned ? "実行予定の変更" : "登録プランのプレビュー"}</h3><div className="plan-fqdn">{fqdn}</div><ol className="steps"><li><b>01</b><span>競合を確認<small>DNS・プロバイダー・管理履歴を照合</small></span></li><li><b>02</b><span>{provider} に関連付け<small>{target} を公開先として指定</small></span></li><li><b>03</b><span>DNS と状態を確認<small>{provider === "Vercel" ? "DNS Only CNAME を必要な場合に作成" : "既存レコードを上書きしない"}</small></span></li></ol><p className="plan-note">{planned ? "次の画面で、競合結果と作成・ロールバック対象を確認してから実行できます。" : "入力後に計画を作成すると、外部APIに接続して競合と対象の存在を確認します。"}</p></aside>
    </div>
  </section>;
}
