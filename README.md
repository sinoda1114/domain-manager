# ShinoDev Domain Manager

`shinodev.com` 配下のサブドメインを、Vercel と Cloudflare の公開先へ安全に割り当てる管理画面です。

## 現在の実装範囲

- 管理画面の基本レイアウト
- サブドメイン入力の正規化と予約語・DNSラベル検証
- Vercel / Cloudflare Pages / Cloudflare Workers の登録計画プレビュー

外部APIの作成・削除はまだ実装していません。実API連携前に、必ずドライラン、競合確認、監査ログ、リソース所有権確認を実装します。

## 初回セットアップ

1. VercelプロジェクトとPostgreSQLを用意します。
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

- Cloudflare API Token: 対象ゾーンのDNS読み取り・編集、および対象アカウントのPages/Workers参照・カスタムドメイン操作に必要な最小権限
- Vercel Token: 対象プロジェクトの参照・カスタムドメイン管理に必要な最小権限

トークン、Cookie、パスワード、接続文字列はクライアントや監査ログへ出力しません。
