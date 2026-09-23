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
  // 最後に表示へ反映したサーバの値。undefined は「次の描画でサーバの値に合わせ直す」印。
  const [syncedDeleteAt, setSyncedDeleteAt] = useState<string | null | undefined>(deleteAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 行の key は domain.id で安定しており、router.refresh() では再マウントされない。
  // サーバの値（props）が変わったら表示を合わせ、別タブや cron による変更を反映する。
  // error はここで消さない。保存失敗の直後にも refresh で同期が走るため、消すと失敗の理由が見えなくなる。
  if (deleteAt !== syncedDeleteAt) {
    setSyncedDeleteAt(deleteAt);
    setValue(deleteAt);
  }

  const save = async (nextValue: string | null) => {
    setValue(nextValue ? toJstIso(nextValue) : null); setSaving(true); setError("");
    try {
      const response = await fetch("/api/domains/schedule", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, deleteAt: toJstIso(nextValue) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "削除日時を更新できませんでした。");
      router.refresh();
    } catch (caught) {
      // 保存前の値ではなく、サーバの最新の状態に合わせ直す。409 はドメインが処理中になった・削除されたなど、
      // サーバ側が変わったときに返るため、手元の props も古いことがある。refresh で props を取り直し、
      // 同期済みの印を外して、届いた props（削除日時と無効化の状態）に表示を合わせる。
      setSyncedDeleteAt(undefined);
      router.refresh();
      setError(caught instanceof Error ? caught.message : "削除日時を更新できませんでした。");
    } finally { setSaving(false); }
  };
  return <div className="domain-schedule"><span className="schedule-label">自動削除</span><SchedulePicker value={value} onChange={save} disabled={disabled || saving} compact />{saving && <span className="schedule-saving">保存中…</span>}{error && <span className="schedule-error" role="alert">{error}</span>}</div>;
}
