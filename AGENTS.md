# ShinoDev Domain Manager — プロジェクト指示

ShinoDev Domain Manager（`domains.shinodev.com`）の AI 向けプロジェクト指示。

## 運用ルール（HOW）の正本

このプロジェクトの開発フロー（worktree / PR / 2 段ゲート / デプロイ規律 / GitHub 正本 / Issue・Project タスク管理 / 供給網デフォルト）は、**本リポの `notes/`** を正本とする（リポと一緒に travel する）。
同じ挙動規律は `~/.claude` グローバルにも既定として入っているため、自分の端末の全 PJ に自動適用される。
**ここには挙動の再説明を書かない**（重複・ドリフト防止）。このファイルは**このプロジェクト固有の値だけ**を持つ。

- 開発フロー詳細: `notes/dev-workflow-multiagent.md`
- タスク管理詳細: `notes/task-management-issue-workflow.md`

## このプロジェクト固有の値

| 項目 | 値 |
|---|---|
| リポ実体 dir（統合＋デプロイ専用・ここで機能開発しない） | `~/dev/domain-manager` |
| GitHub | `sinoda1114/domain-manager` |
| デプロイ基盤 | Vercel（git 駆動・feature push = Preview / main マージ = Production） |
| 本番 URL | https://domains.shinodev.com |
| 独自ドメイン | domains.shinodev.com |
| 絶対 URL の env | `NEXT_PUBLIC_SITE_URL`（=`https://domains.shinodev.com`・ハードコード禁止） |
| タスク正本 | GitHub Issue / Project「domain-manager」 |

## 役割境界（このプロジェクト）

<!-- 担当エージェント/領域を列挙して、担当外ファイルを触らない境界にする。例:
| 領域 | 担当 |
|---|---|
| UI / 配色 / 画面 | ui-feature |
| 認証 / 課金 | auth-billing |
| データ取得 | data-squad |
| 法務 / SEO / インフラ | legal-seo-infra |
| 整合監督・レビュー（実装しない） | reviewer |
-->

## dev 規律

- dev サーバ起動中にビルド成果物を消したり本番ビルドを実行しない（壊れる）。dev は 1 つ。
- 実装は原則 TDD（テスト先行）で進める。テストを先に書き、失敗を確認してから最小実装、その後リファクタする。
- AI 検証は `tsc` / `eslint` / `test` で行う（手動確認をユーザーに丸投げしない）。
- ユーザー向けの主要フローには E2E テスト（Playwright 等）を用意し、マージ前に通す。単体・結合テストだけで済ませない。
- `.env.local` は触らない・中身を出力しない（本番 env は Vercel ダッシュボードが正本）。
- シークレット（API キー・トークン）はログ / 出力に出さない。必要なら redact する。

## Cursor Cloud specific instructions

Next.js 16（App Router / Turbopack）+ Turso(libSQL) + next-auth の管理画面。単一サービス。標準コマンドは `package.json` の scripts と `README.md` を正本とする（`pnpm dev` / `build` / `lint` / `typecheck` / `db:migrate`）。依存は update script が `pnpm install --frozen-lockfile --ignore-scripts` で毎回入れ直す（`.npmrc` の `ignore-scripts=true` によりライフサイクルスクリプトは走らない）。

ローカル DB とローカル起動の非自明な注意点（Cloud VM で初回に一度だけ実施。スナップショットに残らなければ再実施）:

- **ローカル libSQL**: 本番 Turso の代わりにローカル libSQL サーバを使う。turso CLI が無ければ `curl -sSfL https://get.tur.so/install.sh | bash`（`~/.turso` に入る）。起動は別プロセスで `turso dev --db-file /workspace/local-dev.db --port 8080`（tmux 等で常駐）。`local-dev.db` はコミットしない。
- **接続 URL の落とし穴**: `src/lib/env.ts` は `TURSO_DATABASE_URL` が `libsql://` 始まりを必須とする。ローカル `turso dev` は非 TLS なので `TURSO_DATABASE_URL=libsql://127.0.0.1:8080?tls=0` とする（`?tls=0` が無いと TLS 接続を試みて失敗）。`TURSO_AUTH_TOKEN` はローカルでは任意値でよいが空だと検証に落ちるため何か入れる。
- **`.env.local` の `$` エスケープ**: `ADMIN_PASSWORD_HASH`（`scrypt$N$r$p$salt$hash` 形式）は `$` を含む。Next.js の dotenv-expand が `$...` を変数展開して壊すため、`.env.local` では `$` を `\$` にエスケープして書く（例: `scrypt\$16384\$8\$1\$...`）。ハッシュ生成は Node の `crypto.scryptSync` で作れる。`pnpm db:migrate` が読む Node 標準 `loadEnvFile` は展開しないので Turso 系だけなら問題は出ない。
- **認証モード**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_ALLOWED_EMAIL` を **1 つでも** 設定すると Google 専用ログインに切り替わりパスワードログインが 403 になる（`src/lib/google-auth.ts`）。ローカルではこれらを未設定にしてパスワードログインを使う。
- **起動手順**: DB 起動 → `.env.local` 用意 → `pnpm db:migrate` → `pnpm dev`（http://localhost:3000）。`/api/health` が `{"ok":true,"database":"connected"}` を返せば DB 接続 OK。ログインは `/login` で管理者パスワード。
- **ドメイン登録フローの外部依存**: サブドメイン登録 UI は `listProviderTargets()` が Cloudflare / Vercel の実 API を GET するため、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_ZONE_ID` / `VERCEL_TOKEN` / `VERCEL_TEAM_ID` が無いと公開先が空になり下書き作成が失敗する。これらが無くてもログイン・ダッシュボード表示・DB 疎通・ヘルスチェックは検証できる。候補生成には `GEMINI_API_KEY` が別途必要。

