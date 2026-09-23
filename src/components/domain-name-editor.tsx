"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DomainNameEditor({ domainId, displayName, disabled = false }: { domainId: string; displayName: string | null; disabled?: boolean }) {
  const router = useRouter();
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const [seenDisplayName, setSeenDisplayName] = useState(displayName);
  const [value, setValue] = useState(displayName ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (displayName !== seenDisplayName) {
    setSeenDisplayName(displayName);
    setOptimisticName(null);
  }

  const shownName = optimisticName ?? displayName;

  const cancel = () => { setValue(shownName ?? ""); setError(""); setEditing(false); };
  const save = async () => {
    const nextValue = value.trim();
    if (!nextValue) { setError("サービス名を入力してください。"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/domains/name", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, displayName: nextValue }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "サービス名を更新できませんでした。");
      setOptimisticName(nextValue); setValue(nextValue); setEditing(false); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "サービス名を更新できませんでした。"); }
    finally { setSaving(false); }
  };
  if (!editing) return <div className="domain-name"><small>サービス名</small><strong>{shownName ?? "未設定"}</strong><button type="button" onClick={() => { setValue(shownName ?? ""); setEditing(true); }} disabled={disabled}>変更</button></div>;
  return <div className="domain-name domain-name-editing"><label htmlFor={`service-name-${domainId}`}>サービス名</label><input id={`service-name-${domainId}`} value={value} onChange={(event) => setValue(event.target.value)} maxLength={100} disabled={saving} autoFocus /><div><button type="button" onClick={cancel} disabled={saving}>取消</button><button type="button" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>{error && <span role="alert">{error}</span>}</div>;
}
