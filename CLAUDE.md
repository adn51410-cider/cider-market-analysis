# プロジェクト設定

## 基本設定
```yaml
プロジェクト名: シードル市場分析ダッシュボード
開始日: 2026-01-08
技術スタック:
  frontend: React 18 + TypeScript 5 + MUI v6 + Recharts
  backend: Next.js 15 (APIルート)
  database: PostgreSQL (Neon)
  hosting_dev: Vercel
  hosting_prod: Google Cloud Run
```

## 開発環境
```yaml
ポート設定:
  # 複数プロジェクト並行開発のため、一般的でないポートを使用
  frontend: 3247
  backend: 3247  # Next.jsは同一プロセス
  database: N/A  # Neonはクラウド

環境変数:
  設定ファイル: .env.local（ルートディレクトリ）
  必須項目:
    - DATABASE_URL  # Neon接続URL
    - ESTAT_API_KEY  # e-Stat APIアプリケーションID
    - NEXT_PUBLIC_APP_URL  # アプリケーションURL（開発時: http://localhost:3247）
```

## テスト認証情報
```yaml
開発用アカウント:
  # MVP版は認証不要（ゲストアクセス）
  email: N/A
  password: N/A

外部サービス:
  e-Stat API:
    登録URL: https://www.e-stat.go.jp/api/
    用途: 政府統計データ自動取得
    制限: リクエストレート制限あり（詳細は登録時確認）

  Neon:
    登録URL: https://neon.tech
    用途: PostgreSQLデータベース（APIキャッシュ）
    無料枠: 512MB RAM、10GB ストレージ

  Vercel:
    登録URL: https://vercel.com
    用途: 開発・検証環境ホスティング
    無料枠: 個人利用可能
```

## コーディング規約

### 命名規則
```yaml
ファイル名:
  - コンポーネント: PascalCase.tsx (例: MarketDashboard.tsx)
  - ユーティリティ: camelCase.ts (例: formatDate.ts)
  - 定数: UPPER_SNAKE_CASE.ts (例: API_ENDPOINTS.ts)

変数・関数:
  - 変数: camelCase
  - 関数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - 型/インターフェース: PascalCase
```

### コード品質
```yaml
必須ルール:
  - TypeScript: strictモード有効
  - 未使用の変数/import禁止
  - console.log本番環境禁止
  - エラーハンドリング必須
  - 関数行数: 100行以下（96.7%カバー）
  - ファイル行数: 700行以下（96.9%カバー）
  - 複雑度(McCabe): 10以下
  - 行長: 120文字

フォーマット:
  - インデント: スペース2つ
  - セミコロン: あり
  - クォート: シングル
```

## プロジェクト固有ルール

### APIエンドポイント
```yaml
命名規則:
  - RESTful形式を厳守
  - ケバブケース使用 (/market-data, /api/health)

例:
  - GET /api/market-data?category={酒類}&from={開始年月}&to={終了年月}
  - GET /api/health
```

### 型定義
```yaml
配置:
  frontend: src/types/index.ts
  backend: src/types/index.ts

同期ルール:
  - 両ファイルは常に同一内容を保つ
  - 片方を更新したら即座にもう片方も更新

主要型:
  - MarketData: 市場データエンティティ
  - AlcoholCategory: 酒類カテゴリー（enum）
  - AnalysisView: 分析視点（enum）
  - ApiCache: e-Stat APIキャッシュ
```

## データ取得ルール

### e-Stat API連携
```yaml
キャッシュ戦略:
  - 全てのAPIレスポンスをPostgreSQLにキャッシュ
  - 有効期限: 5分間
  - キャッシュキー: エンドポイント + パラメータのハッシュ

エラーハンドリング:
  - API制限エラー: キャッシュから返却
  - ネットワークエラー: リトライ3回（指数バックオフ）
  - タイムアウト: 10秒
```

### データ補完
```yaml
CSV手動インポート:
  - フォーマット: category, year_month, value, data_type
  - バリデーション: 酒類カテゴリーは許可リストのみ
  - 重複チェック: 同一カテゴリー・年月のデータは上書き確認
```

## チャート・レポート

### Recharts設定
```yaml
共通設定:
  - アニメーション: isAnimationActive={false}（PDF出力時）
  - レスポンシブ: ResponsiveContainerで包む
  - 色指定: MUIテーマカラーを使用

ワイン・日本酒の強調:
  - ワイン: primary color (#1976d2)
  - 日本酒: secondary color (#dc004e)
  - その他: グレースケール
```

### PDF生成
```yaml
プロセス:
  1. html2canvasでグラフをCanvas化
  2. CanvasからBase64画像取得
  3. @react-pdf/rendererでPDF生成
  4. 画像をPDFに埋め込み

デザイン仕様:
  - フォント: メイリオ
  - タイトル: 18pt太字
  - 本文: 12pt
  - レイアウト: 1ページ1グラフの原則
  - 余白: 上下左右20mm
  - グラフサイズ: A4の70%

制限:
  - 1レポートあたり最大10グラフ（メモリ制約）
  - 画像解像度: 2x（Retina対応）
```

## デプロイ戦略

### 段階的デプロイ
```yaml
Phase 1: 開発・検証（Vercel）
  環境: development
  URL: https://cider-market-analysis.vercel.app
  自動デプロイ: mainブランチプッシュ時

Phase 2: 本番運用（Google Cloud Run）
  環境: production
  リージョン: asia-northeast1（東京）
  最小インスタンス: 0
  最大インスタンス: 10
  CPU: 1
  メモリ: 512Mi
```

## 🆕 最新技術情報（知識カットオフ対応）

```yaml
# 実現可能性調査で確認済み

React 18:
  - Concurrent Rendering対応
  - Automatic Batching有効

MUI v6:
  - Pigment CSS採用（ビルド時スタイル抽出）
  - MUI X Charts組み込み（Rechartsとは別）

TanStack Query v5:
  - WebTransportプロトコル対応
  - 予測的プリフェッチサポート

e-Stat API:
  - 2026年現在も稳定稼働
  - レート制限: 詳細は登録後確認
  - レスポンス形式: JSON/XML/CSV

Neon PostgreSQL:
  - 2026年現在、無料枠継続中
  - ブランチ機能で開発/本番分離可能
```

## プロジェクト構成

```
/
├── src/
│   ├── components/
│   │   ├── charts/           # Rechartsラッパー
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   └── PieChart.tsx
│   │   ├── dashboard/        # ダッシュボードコンポーネント
│   │   │   ├── MarketOverview.tsx
│   │   │   ├── ComparisonView.tsx
│   │   │   └── FilterPanel.tsx
│   │   └── pdf/              # PDF生成コンポーネント
│   │       └── ReportDocument.tsx
│   ├── hooks/
│   │   └── queries/          # TanStack Query hooks
│   │       ├── useMarketData.ts
│   │       └── useEstatApi.ts
│   ├── stores/               # Zustand stores
│   │   ├── dashboardStore.ts
│   │   └── reportStore.ts
│   ├── services/             # API通信
│   │   └── api.ts
│   ├── utils/
│   │   ├── dataExport.ts    # CSV/JSON エクスポート
│   │   ├── dataImport.ts    # データインポート
│   │   └── chartCapture.ts  # チャート画像化
│   ├── types/
│   │   └── index.ts         # TypeScript型定義
│   ├── pages/
│   │   ├── index.tsx        # P-001: 市場分析ダッシュボード
│   │   └── report.tsx       # P-002: レポート出力
│   └── app/
│       └── api/
│           ├── market-data/
│           │   └── route.ts  # 市場データ取得API
│           └── health/
│               └── route.ts  # ヘルスチェック
├── docs/
│   ├── requirements.md      # 要件定義書
│   └── SCOPE_PROGRESS.md    # 進捗管理
├── .env.local               # 環境変数（Git管理外）
├── .env.example             # 環境変数テンプレート
├── eslint.config.js         # ESLint設定
├── .prettierrc              # Prettier設定
├── CLAUDE.md                # このファイル
└── README.md                # プロジェクト概要
```

## 重要な注意事項

### MVP（2ページ）の原則
```yaml
実装範囲:
  - P-001: 市場分析ダッシュボード
  - P-002: レポート出力
  - 以上2ページのみ

実装しないもの:
  - 認証機能
  - ユーザー管理
  - 分析視点別の個別ページ
  - カスタムデータ登録
  - 予測分析
  - 地域別分析

拡張タイミング:
  - MVP検証後、Phase 11（機能拡張オーケストレーター）で実施
```

### シードルデータの扱い
```yaml
注意点:
  - 日本の税法上「果実酒」に分類
  - シードル単独の統計データは限定的
  - ワイン・果実酒カテゴリーとして扱う

データソース:
  - e-Stat API: 家計調査（果実酒カテゴリー）
  - 国税庁: 酒税課税状況表（果実酒）
  - 推定: 果実酒市場におけるシードルシェアを手動補完
```

### セキュリティ
```yaml
開発環境:
  - .env.localはGit管理外（.gitignoreに追加必須）
  - APIキーは絶対にコミットしない

本番環境:
  - HTTPS強制
  - セキュリティヘッダー設定（Next.js設定）
  - Cloud Run環境変数でAPIキー管理
```

### 13. E2Eテスト自律実行の絶対原則

**【重要】セッション開始時・compact後の自動判定**

このセクションはE2Eテストオーケストレーターによって自動生成されました。

---

**最初に必ず専門知識を注入してください**

E2Eテスト実行中の場合、以下を実行してから開始してください：

```
inject_knowledge ツールで keyword: "@E2Eテストオーケストレーター"
を実行してから開始してください。（初回必須・compact後も必須）
```

重要：キーワードは "@E2Eテストオーケストレーター"
をそのまま使用してください。変換や推測は不要です。

準備完了です。まず知識注入を実行してから、タスクを開始してください。

---

**E2Eテストオーケストレーター実行中の判定**:
- SCOPE_PROGRESS.mdに「## 📊 E2Eテスト全体進捗」が存在する場合
- または、セッション再開時に前回のメッセージに「E2Eテスト」「オーケストレーター」キーワードがある場合

**セッション開始時・compact後の自動処理**:
1. 上記の判定基準でE2Eテスト実行中と判定
2. inject_knowledge('@E2Eテストオーケストレーター') を必ず実行
3. docs/e2e-best-practices.md の存在確認（なければ初期テンプレート作成）
4. SCOPE_PROGRESS.mdから [ ] テストの続きを自動で特定
5. [x] のテストは絶対にスキップ
6. ユーザー確認不要、完全自律モードで継続
7. ページ選定も自動（未完了ページを上から順に選択）
8. 停止条件：全テスト100%完了のみ

**5回エスカレーション後の処理**:
- チェックリストに [-] マークを付ける
- docs/e2e-test-history/skipped-tests.md に記録
- 次のテストへ自動で進む（停止しない）

**ベストプラクティス自動蓄積**:
- 各テストで成功した方法を docs/e2e-best-practices.md に自動保存
- 後続テストが前のテストの知見を自動活用
- 試行錯誤が減っていく（学習効果）

**重要**:
- この原則はCLAUDE.mdに記載されているため、compact後も自動で適用される
- セッション開始時にこのセクションがない場合、オーケストレーターが自動で追加する
