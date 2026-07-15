"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDomainButton({ domainId, fqdn }: { domainId: string; fqdn: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expected = `${fqdn}を削除`;

  const remove = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/domains/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, confirmation: value }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "削除できませんでした。");
      setOpen(false); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "削除できませんでした。"); } finally { setBusy(false); }
  };

  if (!open) return <button type="button" className="danger-action" onClick={() => setOpen(true)}>削除</button>;
  return <div className="inline-confirm"><strong>{fqdn}を削除</strong><small>このツールが作成した外部設定だけを削除します。</small><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={expected} autoComplete="off" disabled={busy} aria-label="削除確認" />{error && <span role="alert">{error}</span>}<div><button type="button" onClick={() => setOpen(false)} disabled={busy}>戻る</button><button type="button" onClick={remove} disabled={value !== expected || busy}>{busy ? "削除中…" : "削除を実行"}</button></div></div>;
}
