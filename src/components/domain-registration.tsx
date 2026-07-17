"use client";
/* eslint-disable @next/next/no-img-element -- 外部ブランドアイコンは小さな装飾要素として直接表示する。 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProviderTarget } from "@/infrastructure/providers/targets";
import { SchedulePicker } from "@/components/schedule-picker";

const reserved = new Set(["www", "api", "admin", "domains", "mail", "smtp", "imap", "pop", "ftp", "cdn", "static", "assets", "status", "support", "help", "docs", "dev", "test", "staging", "_acme-challenge"]);
const providerLabels = { vercel: "Vercel", cloudflare_pages: "Cloudflare Pages", cloudflare_workers: "Cloudflare Workers" };
const providers = [{ value: "vercel", label: "Vercel", icon: "https://cdn.simpleicons.org/vercel/171717" }, { value: "cloudflare_pages", label: "Pages", icon: "https://cdn.simpleicons.org/cloudflare/F38020" }, { value: "cloudflare_workers", label: "Workers", icon: "https://cdn.simpleicons.org/cloudflare/F38020" }] as const;
const purposeOptions = [{ value: "product", label: "プロダクト", icon: "◈" }, { value: "console", label: "管理画面", icon: "⚙" }, { value: "api", label: "API", icon: "⌁" }, { value: "campaign", label: "キャンペーン", icon: "↗" }, { value: "docs", label: "ドキュメント", icon: "▤" }, { value: "internal", label: "社内ツール", icon: "⌂" }] as const;
const toneOptions = [{ value: "concise", label: "端的", icon: "—" }, { value: "descriptive", label: "説明的", icon: "≡" }, { value: "brand", label: "ブランド", icon: "✦" }] as const;
type Provider = keyof typeof providerLabels;
type Purpose = (typeof purposeOptions)[number]["value"];
type Tone = (typeof toneOptions)[number]["value"];
type Suggestion = { label: string; rationale: string };
type SuggestionGroup = { purpose: Purpose; tone: Tone; candidates: Suggestion[] };

function validationMessage(label: string) {
  if (!label) return "サブドメイン名を入力してください。";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return "英小文字・数字・ハイフンのみ、先頭と末尾のハイフンは使用できません。";
  if (reserved.has(label)) return "この名前はシステム予約語のため使用できません。";
  return "";
}

function toJstIso(value: string) {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DomainRegistration({ rootDomain, targets, compact = false }: { rootDomain: string; targets: ProviderTarget[]; compact?: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [deleteAt, setDeleteAt] = useState("");
  const [provider, setProvider] = useState<Provider>("vercel");
  const [targetId, setTargetId] = useState(() => targets.find((target) => target.provider === "vercel")?.id ?? "");
  const [purposes, setPurposes] = useState<Purpose[]>(["product"]);
  const [tones, setTones] = useState<Tone[]>(["concise"]);
  const [candidateCount, setCandidateCount] = useState(3);
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestionAuthRequired, setSuggestionAuthRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const error = useMemo(() => validationMessage(label), [label]);
  const availableTargets = targets.filter((target) => target.provider === provider);
  const target = availableTargets.find((candidate) => candidate.id === targetId);
  const fqdn = label ? `${label}.${rootDomain}` : "";

  const togglePurpose = (purpose: Purpose) => setPurposes((current) => current.includes(purpose) ? (current.length === 1 ? current : current.filter((item) => item !== purpose)) : [...current, purpose]);
  const toggleTone = (tone: Tone) => setTones((current) => current.includes(tone) ? (current.length === 1 ? current : current.filter((item) => item !== tone)) : [...current, tone]);

  const changeProvider = (value: Provider) => { setProvider(value); setTargetId(targets.find((candidate) => candidate.provider === value)?.id ?? ""); setSuggestions([]); setSelectedSuggestion(""); setRequestError(""); };
  const suggest = async () => {
    if (!target) return;
    setSuggesting(true); setSuggestionError(""); setSuggestionAuthRequired(false);
    try {
      const response = await fetch("/api/domains/suggestions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectName: target.name, repositoryName: target.repositoryName, purposes, tones, candidateCount }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) setSuggestionAuthRequired(true);
        throw new Error(body.error ?? "候補を生成できませんでした。");
      }
      setSuggestions(body.groups); setSelectedSuggestion("");
    } catch (caught) { setSuggestionError(caught instanceof Error ? caught.message : "候補を生成できませんでした。"); } finally { await new Promise((resolve) => setTimeout(resolve, 650)); setSuggesting(false); }
  };
  const openConfirmation = () => {
    if (error || !target) return;
    setConfirmationChecked(false); setConfirmationError(""); setAuthRequired(false); setConfirmationClosing(false); setConfirmationOpen(true);
  };
  const closeConfirmation = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setConfirmationOpen(false); return; }
    setConfirmationClosing(true);
    setTimeout(() => { setConfirmationOpen(false); setConfirmationClosing(false); }, 130);
  };
  const reflectDomain = async () => {
    if (error || !target || !confirmationChecked || confirmationClosing) return;
    setSubmitting(true); setRequestError("");
    try {
      const response = await fetch("/api/domains/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, provider, targetId, deleteAt: toJstIso(deleteAt) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { setAuthRequired(true); throw new Error("反映には管理者ログインが必要です。"); }
        throw new Error(body.error ?? "下書きを作成できませんでした。");
      }
      const executeResponse = await fetch("/api/domains/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId: body.domain.id, confirmation: `${fqdn} を反映` }) });
      if (!executeResponse.ok) {
        if (executeResponse.status === 401) { setAuthRequired(true); throw new Error("反映には管理者ログインが必要です。"); }
        throw new Error("反映前の確認に失敗しました。下書きは保存されています。管理中のドメインから再確認できます。");
      }
      setConfirmationOpen(false); setConfirmationClosing(false); setConfirmationChecked(false); router.refresh();
    } catch (caught) { setConfirmationError(caught instanceof Error ? caught.message : "反映を開始できませんでした。"); } finally { setSubmitting(false); }
  };

  return <section className={compact ? "panel registration registration-compact" : "panel registration"} id="register">
    {!compact && <div className="panel-heading"><h2>サブドメインを追加</h2></div>}
    <div className={compact ? "register-grid compact-grid" : "register-grid"}><div className="form-area">
      <div className="field"><label>配置先</label><div className="provider-options" role="radiogroup" aria-label="配置先">{providers.map((item) => <button type="button" role="radio" aria-checked={provider === item.value} className={provider === item.value ? "selected" : ""} key={item.value} onClick={() => changeProvider(item.value)}><img src={item.icon} alt="" /><span>{item.label}</span></button>)}</div></div>
      <div className="field target-field"><label htmlFor="target">公開先プロジェクト / リポジトリ</label><select id="target" value={targetId} onChange={(event) => { setTargetId(event.target.value); setSuggestions([]); setSelectedSuggestion(""); }} disabled={availableTargets.length === 0}>{availableTargets.length === 0 ? <option>利用できる公開先がありません</option> : availableTargets.map((item) => <option key={item.id} value={item.id}>{item.repositoryName ? `${item.name} · ${item.repositoryName}` : item.name}</option>)}</select>{target?.repositoryName && <span className="hint">リポジトリ: {target.repositoryName}</span>}</div>
      <div className="suggestion-controls"><div className="field purpose-control"><label>用途 <small>複数選択可</small></label><div className="choice-options" role="group" aria-label="用途">{purposeOptions.map((item) => <button type="button" aria-pressed={purposes.includes(item.value)} className={purposes.includes(item.value) ? "selected" : ""} key={item.value} onClick={() => togglePurpose(item.value)}><i>{item.icon}</i><span>{item.label}</span></button>)}</div></div><div className="field tone-control"><label>スタイル <small>複数選択可</small></label><div className="choice-options tone-options" role="group" aria-label="スタイル">{toneOptions.map((item) => <button type="button" aria-pressed={tones.includes(item.value)} className={tones.includes(item.value) ? "selected" : ""} key={item.value} onClick={() => toggleTone(item.value)}><i>{item.icon}</i><span>{item.label}</span></button>)}</div></div><div className="field count-control"><label htmlFor="candidate-count">候補数</label><select id="candidate-count" value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select></div><button className={`suggest-button${suggesting ? " is-loading" : ""}`} type="button" disabled={!target || suggesting} onClick={suggest} aria-live="polite"><span className="suggest-spinner" aria-hidden="true" />{suggesting ? "候補を生成中…" : "候補を生成"}</button></div>
      {suggestionError && <div className="reflection-error" role="alert"><span>{suggestionError}</span>{suggestionAuthRequired && <a href="/login">管理者ログインへ</a>}</div>}
      {suggestions.length > 0 && <div className="suggestion-results" aria-live="polite"><p><b>名前の候補</b><span>選ぶと採用する名前に反映されます</span></p>{suggestions.map((group) => <section className="suggestion-group" key={`${group.purpose}-${group.tone}`}><h3><span className="group-purpose">{purposeOptions.find((item) => item.value === group.purpose)?.label}</span><span className="group-divider">/</span><span className="group-tone">{toneOptions.find((item) => item.value === group.tone)?.label}</span></h3><div>{group.candidates.map((candidate) => <button type="button" className={selectedSuggestion === candidate.label ? "selected" : ""} key={candidate.label} onClick={() => { setLabel(candidate.label); setSelectedSuggestion(candidate.label); }}><strong>{candidate.label}<small>.{rootDomain}</small></strong><span>{candidate.rationale}</span></button>)}</div></section>)}</div>}
      <div className="field"><label htmlFor="label">サブドメインを追加</label><input id="label" value={label} onChange={(event) => { setLabel(event.target.value.toLowerCase()); setSelectedSuggestion(""); }} placeholder="sample" aria-invalid={Boolean(error)} aria-describedby="label-validation" /><span className="hint">{fqdn}</span></div>
      {error && <p className="validation" id="label-validation" role="alert">{error}</p>}{requestError && <p className="validation" role="alert">{requestError}</p>}
      <div className="field delete-schedule"><label htmlFor="delete-at">自動削除日時 <small>任意</small></label><SchedulePicker id="delete-at" value={deleteAt || null} onChange={(value) => setDeleteAt(value ?? "")} /><span className="hint">指定した日時以降に外部設定を削除します（日本時間）</span></div>
      <div className="draft-summary"><div><span>反映するサブドメイン</span><strong>{fqdn}</strong></div><div><span>公開先</span><strong>{target ? `${providerLabels[provider]} / ${target.name}` : "未選択"}</strong>{target?.sourceUrl && <a className="source-link" href={target.sourceUrl} target="_blank" rel="noreferrer">実体URL ↗</a>}</div><div><span>自動削除</span><strong>{deleteAt ? formatJst(toJstIso(deleteAt) ?? deleteAt) : "設定なし"}</strong></div><small>確認後に反映</small></div><div className="form-actions"><span className="dry-run">反映前に内容を確認できます</span><button className="plan-button" type="button" disabled={Boolean(error) || !target || submitting} onClick={openConfirmation}>反映内容を確認</button></div>
    </div></div>
    {confirmationOpen && <div className={`reflection-modal-backdrop${confirmationClosing ? " is-closing" : ""}`} role="presentation"><section className={`reflection-modal${confirmationClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="reflection-title"><div className="reflection-modal-header"><div><span className="eyebrow">REFLECTION CHECK</span><h2 id="reflection-title">反映内容を確認</h2></div><button type="button" className="modal-close" onClick={closeConfirmation} disabled={submitting || confirmationClosing} aria-label="閉じる">×</button></div><dl className="reflection-details"><div><dt>サブドメイン</dt><dd>{fqdn}</dd></div><div><dt>公開先</dt><dd>{providerLabels[provider]} / {target?.name}</dd></div><div><dt>実行される変更</dt><dd>DNSと公開先のカスタムドメイン設定</dd></div>{deleteAt && <div><dt>自動削除</dt><dd>{formatJst(toJstIso(deleteAt) ?? deleteAt)}（日本時間）</dd></div>}</dl><p className="reflection-warning">外部サービスへ反映します。自動ロールバックは行いません。反映後は公開状態を自動で確認します。</p><label className="reflection-check"><input type="checkbox" checked={confirmationChecked} onChange={(event) => setConfirmationChecked(event.target.checked)} disabled={submitting || confirmationClosing} />上記の内容を確認し、外部サービスへ反映します</label>{confirmationError && <div className="reflection-error" role="alert"><span>{confirmationError}</span>{authRequired && <a href="/login">管理者ログインへ</a>}</div>}<div className="reflection-actions"><button type="button" onClick={closeConfirmation} disabled={submitting || confirmationClosing}>戻る</button><button type="button" onClick={reflectDomain} disabled={!confirmationChecked || submitting || confirmationClosing}>{submitting ? "反映中…" : "反映を実行"}</button></div></section></div>}
  </section>;
}
