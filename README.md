# ShinoDev Domain Manager

`shinodev.com` 配下のサブドメインを、Vercel と Cloudflare の公開先へ安全に割り当てる管理画面です。

## 現在の実装範囲

- 管理画面の基本レイアウト
- サブドメイン入力の正規化と予約語・DNSラベル検証
- Vercel / Cloudflare Pages / Cloudflare Workers の登録計画プレビュー

外部APIの作成・削除はまだ実装していません。実API連携前に、必ずドライラン、競合確認、監査ログ、リソース所有権確認を実装します。

初期Tursoスキーマは [`db/migrations/0001_initial.sql`](./db/migrations/0001_initial.sql) で管理します。

## 初回セットアップ

1. VercelプロジェクトとTursoデータベースを用意します。
2. `.env.example` を参照して、Vercelの環境変数を設定します。値はリポジトリへ保存しません。
3. Vercelから環境変数を取得します。

   ```bash
   vercel env pull .env.local --yes
   ```

4. 依存関係をインストールし、品質チェックを実行します。

   ```bash
   pnpm install
   pnpm lint
   pnpm typecheck
   ```

本リポジトリでは `.npmrc` により、依存関係のライフサイクルスクリプトを自動実行しません。ネイティブ依存が必要になった場合は、対象パッケージを個別に確認・許可してください。

## 必要な権限

- `CLOUDFLARE_ZONE_ID`: [Cloudflare Dashboard](https://dash.cloudflare.com/) で `shinodev.com` を開き、Overview画面から取得するゾーンIDです。
- `CLOUDFLARE_API_TOKEN`: [API Tokens](https://dash.cloudflare.com/profile/api-tokens) から作成する専用トークンです。Zone Resourcesは `shinodev.com` だけ、Account Resourcesはこのアカウントだけに絞ります。
  - Zone / DNS / Edit
  - Zone / Zone / Read
  - Account / Cloudflare Pages / Read・Edit
  - Account / Workers Scripts / Read・Edit
- `VERCEL_TOKEN`: [Vercel Tokens](https://vercel.com/account/tokens) で作成する専用トークンです。`domain-manager` が所属するチームで、プロジェクト参照・カスタムドメイン追加/削除に使います。

設定先は [Vercel Project `domain-manager` のEnvironment Variables](https://vercel.com/sinoda1114s-projects/domain-manager/settings/environment-variables) です。Production・Preview・Developmentへ同じ値を設定します。値はチャット、リポジトリ、ログへ貼り付けません。

### プロバイダー連携の設定手順

以下は一度だけ行います。トークンの値はこのチャットに貼り付けないでください。

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) を開き、`shinodev.com` を選択します。Overview画面に表示される **Zone ID** をコピーします。
2. [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) を開き、**Create Token** → **Create Custom Token** を選びます。名前は `domain-manager` にします。
3. 権限を次のように追加します。
   - `Zone` / `DNS` / `Edit`
   - `Zone` / `Zone` / `Read`
   - `Account` / `Cloudflare Pages` / `Edit`
   - `Account` / `Workers Scripts` / `Edit`
4. **Zone Resources** は `Include` → `Specific zone` → `shinodev.com` を選びます。**Account Resources** は、このCloudflareアカウントだけを選びます。**Continue to summary** → **Create Token** を実行し、表示されたトークンをコピーします。この値は再表示できません。
5. [Vercel Tokens](https://vercel.com/account/tokens) を開き、**Create Token** を選びます。名前を `domain-manager` にして作成し、トークンをコピーします。
6. [domain-manager のEnvironment Variables](https://vercel.com/sinoda1114s-projects/domain-manager/settings/environment-variables) を開き、**Add New** から以下を登録します。環境は毎回 `Production`、`Preview`、`Development` のすべてを選びます。

   | Name | Value |
   |---|---|
   | `CLOUDFLARE_ZONE_ID` | 手順1でコピーしたZone ID |
   | `CLOUDFLARE_API_TOKEN` | 手順4で作成したCloudflareトークン |
   | `VERCEL_TOKEN` | 手順5で作成したVercelトークン |

7. 3つすべての値を登録できたら、このチャットでは値を送らずに「設定した」とだけ連絡します。

トークン、Cookie、パスワード、Turso接続情報はクライアントや監査ログへ出力しません。
# CI/CD

GitHub Actions がPRで Vercel Preview を作成し、`main` へのpushで Production をデプロイします。GitHub Secrets に `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` を設定してください。値は `.vercel/project.json` とVercelトークンから取得します。
