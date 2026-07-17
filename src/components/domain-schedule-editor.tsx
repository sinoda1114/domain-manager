"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SchedulePicker } from "@/components/schedule-picker";

function toJstIso(value: string | null) {
  if (!value) return null;
  const [date, time] = value.split("T");
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

export function DomainScheduleEditor({ domainId, deleteAt, disabled = false }: { domainId: string; deleteAt: string | null; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(deleteAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (nextValue: string | null) => {
    const previous = value;
    setValue(nextValue ? toJstIso(nextValue) : null); setSaving(true); setError("");
    try {
      const response = await fetch("/api/domains/schedule", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, deleteAt: toJstIso(nextValue) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "削除日時を更新できませんでした。");
      router.refresh();
    } catch (caught) { setValue(previous); setError(caught instanceof Error ? caught.message : "削除日時を更新できませんでした。"); }
    finally { setSaving(false); }
  };
  return <div className="domain-schedule"><span className="schedule-label">自動削除</span><SchedulePicker value={value} onChange={save} disabled={disabled || saving} compact />{saving && <span className="schedule-saving">保存中…</span>}{error && <span className="schedule-error" role="alert">{error}</span>}</div>;
}
