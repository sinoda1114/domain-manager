"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExecuteDomainButton({ domainId, fqdn }: { domainId: string; fqdn: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expected = `${fqdn} を反映`;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/domains/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, confirmation: value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "反映を開始できませんでした。");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "反映を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <button type="button" onClick={() => setOpen(true)}>内容を確認</button>;
  return <div className="execution-confirmation">
    <p><b>{fqdn}</b> を外部サービスへ反映します。</p><small>DNS・公開先への変更後、自動ロールバックは行いません。</small>
    <label htmlFor={`confirmation-${domainId}`}>「{expected}」と入力して実行</label>
    <input id={`confirmation-${domainId}`} value={value} onChange={(event) => setValue(event.target.value)} placeholder={expected} autoComplete="off" />
    {error && <span role="alert">{error}</span>}
    <div><button type="button" onClick={() => setOpen(false)} disabled={busy}>キャンセル</button><button type="button" disabled={value !== expected || busy} onClick={run}>{busy ? "実行中…" : "外部へ反映"}</button></div>
  </div>;
}
