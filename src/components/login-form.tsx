"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
export function LoginForm({ googleEnabled, authSetupRequired = false }: { googleEnabled: boolean; authSetupRequired?: boolean }) {
  const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  if (authSetupRequired) return <div className="google-login-panel"><p role="alert">Google認証を利用できません。管理者による設定確認が必要です。</p></div>;
  async function startGoogleSignIn() {
    setPending(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/" });
  } catch (error) {
    console.error("google_signin_failed", error instanceof Error ? error.message : error);
    setPending(false);
    setError("Googleログインを開始できませんでした。時間をおいて再試行してください。");
  }
  if (googleEnabled) return <div className="google-login-panel"><button className="google-login-button" type="button" onClick={startGoogleSignIn} disabled={pending}>{pending ? "Googleへ移動中…" : "Googleアカウントでログイン"}</button>{error && <p role="alert">{error}</p>}<p>許可されたGoogleアカウントのみ利用できます。</p></div>;
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); setPending(false); if (!response.ok) { setError(response.status === 429 ? "試行回数が上限に達しました。しばらくしてから再試行してください。" : "パスワードを確認してください。"); return; } setPassword(""); router.replace("/"); router.refresh(); }
  return <form className="login-form" onSubmit={submit}><label htmlFor="password">パスワード</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="submit" disabled={pending}>{pending ? "確認中…" : "ログイン"}</button>{error && <p role="alert">{error}</p>}</form>;
}
