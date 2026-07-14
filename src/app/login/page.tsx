import { LoginForm } from "@/components/login-form";

export default function LoginPage() { return <main className="login-shell"><section className="login-card"><p className="eyebrow">SHINODEV DOMAIN MANAGER</p><h1>管理者ログイン</h1><p>ドメイン設定と操作履歴は、認証済みの管理者だけが確認できます。</p><LoginForm /></section></main>; }
