"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export function LoginForm({ googleEnabled, authSetupRequired = false }: { googleEnabled: boolean; authSetupRequired?: boolean }) {
  const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  if (authSetupRequired) return <div className="google-login-panel"><p role="alert">Google認証を利用できません。管理者による設定確認が必要です。</p></div>;
  if (googleEnabled) return <div className="google-login-panel"><Link className="google-login-button" href="/api/auth/signin/google?callbackUrl=%2F" prefetch={false}>Googleアカウントでログイン</Link><p>許可されたGoogleアカウントのみ利用できます。</p></div>;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); setPending(false); if (!response.ok) { setError(response.status === 429 ? "試行回数が上限に達しました。しばらくしてから再試行してください。" : "パスワードを確認してください。"); return; } setPassword(""); router.replace("/"); router.refresh(); }
  return <form className="login-form" onSubmit={submit}><label htmlFor="password">パスワード</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="submit" disabled={pending}>{pending ? "確認中…" : "ログイン"}</button>{error && <p role="alert">{error}</p>}</form>;
}
