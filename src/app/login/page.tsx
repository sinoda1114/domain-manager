import { LoginForm } from "@/components/login-form";
import { isGoogleAuthConfigured, isGoogleAuthRequired } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export default function LoginPage() { const googleEnabled = isGoogleAuthConfigured(); const googleRequired = isGoogleAuthRequired(); return <main className="login-shell"><section className="login-card"><p className="eyebrow">SHINODEV DOMAIN MANAGER</p><h1>管理者ログイン</h1><p>ドメイン設定と操作履歴は、認証済みの管理者だけが確認できます。</p><LoginForm googleEnabled={googleEnabled} authSetupRequired={googleRequired && !googleEnabled} />{googleRequired && !googleEnabled && <p className="auth-setup-note">Google認証の設定が未完了です。管理者が環境変数を確認してください。</p>}{!googleRequired && <p className="auth-setup-note">Google認証の設定完了後、この画面は許可されたGoogleアカウント専用になります。</p>}</section></main>; }
