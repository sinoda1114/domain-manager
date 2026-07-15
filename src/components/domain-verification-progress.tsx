"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PendingStatus = "DNS Pending" | "SSL Pending";

const progressCopy: Record<PendingStatus, { label: string; detail: string }> = {
  "DNS Pending": {
    label: "反映確認中（DNS）",
    detail: "DNS設定を反映中です。公開先へ接続できる状態になるのを待っています。",
  },
  "SSL Pending": {
    label: "反映確認中（SSL）",
    detail: "DNS設定を確認済みです。HTTPS証明書の有効化を確認しています。",
  },
};

function delayFor(elapsed: number) {
  if (elapsed < 60_000) return 60_000;
  if (elapsed < 300_000) return 5_000;
  return 30_000;
}

export function DomainVerificationProgress({ domainId, status }: { domainId: string; status: PendingStatus }) {
  const router = useRouter();
  const [nextCheckAt, setNextCheckAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let stopped = false;
    const startedAt = Date.now();
    let timer: number | undefined;
    const schedule = () => {
      if (stopped) return;
      const delay = delayFor(Date.now() - startedAt);
      setNextCheckAt(Date.now() + delay);
      timer = window.setTimeout(async () => {
        setChecking(true);
        try {
          const response = await fetch("/api/domains/refresh", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ domainId }),
          });
          const body = await response.json().catch(() => ({})) as { status?: string };
          if (response.ok && body.status && body.status !== status) router.refresh();
        } finally {
          if (!stopped) setChecking(false);
          schedule();
        }
      }, delay);
    };
    schedule();
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [domainId, router, status]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = nextCheckAt && now ? Math.max(0, Math.ceil((nextCheckAt - now) / 1_000)) : null;
  const copy = progressCopy[status];

  return <div className="verification-progress" aria-live="polite">
    <span className="status status-pending">{copy.label}</span>
    <small>{copy.detail}</small>
    <small className="next-check">{checking ? "自動確認中…" : seconds === null ? "自動確認を準備中…" : `次回の自動確認まで ${seconds}秒`}</small>
  </div>;
}
