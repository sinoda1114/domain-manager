"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProviderTarget } from "@/infrastructure/providers/targets";

const reserved = new Set(["www", "api", "admin", "domains", "mail", "smtp", "imap", "pop", "ftp", "cdn", "static", "assets", "status", "support", "help", "docs", "dev", "test", "staging", "_acme-challenge"]);
const providerLabels = { vercel: "Vercel", cloudflare_pages: "Cloudflare Pages", cloudflare_workers: "Cloudflare Workers" };
type Provider = keyof typeof providerLabels;

function validationMessage(label: string) {
  if (!label) return "";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return "英小文字・数字・ハイフンのみ、先頭と末尾のハイフンは使用できません。";
  if (reserved.has(label)) return "この名前はシステム予約語のため使用できません。";
  return "";
}

export function DomainRegistration({ rootDomain, targets }: { rootDomain: string; targets: ProviderTarget[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("sample");
  const [provider, setProvider] = useState<Provider>("vercel");
  const [targetId, setTargetId] = useState(() => targets.find((target) => target.provider === "vercel")?.id ?? "");
  const [planned, setPlanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const error = useMemo(() => validationMessage(label), [label]);
  const availableTargets = targets.filter((target) => target.provider === provider);
  const target = availableTargets.find((candidate) => candidate.id === targetId);
  const fqdn = `${label || "…"}.${rootDomain}`;

  const changeProvider = (value: Provider) => {
    setProvider(value);
    setTargetId(targets.find((candidate) => candidate.provider === value)?.id ?? "");
    setPlanned(false);
    setRequestError("");
  };

  const createDraft = async () => {
    if (error || !target) return;
    setSubmitting(true);
    setRequestError("");
    try {
      const response = await fetch("/api/domains/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, provider, targetId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "下書きを作成できませんでした。");
      setPlanned(true);
      router.refresh();
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : "下書きを作成できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  return <section className="panel registration" id="register">
    <div className="panel-heading"><div><p className="eyebrow">NEW ALLOCATION</p><h2>サブドメインを登録</h2></div><span className="dry-run">外部変更前に下書きを作成します</span></div>
    <div className="register-grid">
      <div className="form-area">
        <div className="form-row"><div className="field"><label htmlFor="label">サブドメイン</label><input id="label" value={label} onChange={(event) => { setLabel(event.target.value.toLowerCase()); setPlanned(false); }} placeholder="例: degunavi" /><span className="hint">{fqdn}</span></div><div className="field"><label htmlFor="provider">配置先</label><select id="provider" value={provider} onChange={(event) => changeProvider(event.target.value as Provider)}>{Object.entries(providerLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select><span className="hint">接続済みサービスから選択</span></div></div>
        {error && <p className="validation">{error}</p>}
        <div className="field"><label htmlFor="target">対象プロジェクト / Worker</label><select id="target" value={targetId} onChange={(event) => { setTargetId(event.target.value); setPlanned(false); }} disabled={availableTargets.length === 0}>{availableTargets.length === 0 ? <option>利用できる公開先がありません</option> : availableTargets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        {requestError && <p className="validation">{requestError}</p>}
        <div className="form-actions"><span className="dry-run">下書き作成では DNS・Vercel・Cloudflare を変更しません。</span><button className="plan-button" type="button" disabled={Boolean(error) || !target || submitting} onClick={createDraft}>{submitting ? "作成中…" : "下書きを作成 →"}</button></div>
      </div>
      <aside className="plan" aria-live="polite"><h3>{planned ? "下書きを作成しました" : "登録プランのプレビュー"}</h3><div className="plan-fqdn">{fqdn}</div><ol className="steps"><li><b>01</b><span>対象を確認<small>{target ? `${providerLabels[provider]}: ${target.name}` : "公開先を選択してください"}</small></span></li><li><b>02</b><span>下書きを保存<small>Turso に管理対象と操作履歴を保存</small></span></li><li><b>03</b><span>実行を承認<small>次の操作でDNS・公開先へ変更を適用</small></span></li></ol><p className="plan-note">{planned ? "一覧に下書きを追加しました。実行承認までは外部サービスを変更しません。" : "候補は接続済みの実在プロジェクト・Workerです。"}</p></aside>
    </div>
  </section>;
}
