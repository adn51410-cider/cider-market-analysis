# シードル市場分析ダッシュボード

シードル市場とアルコール市場全体（特にワイン・日本酒）を多角的に比較分析し、データに基づいた販売戦略を立案するためのダッシュボードアプリケーション。

## 🌐 本番環境

**URL**: https://cider-market-analysis.vercel.app

## 🎯 プロジェクト概要

### 成果目標
市場規模・成長率・価格帯・消費者属性・販売チャネル・季節性の6つの視点から、シードルの位置づけと成長機会を可視化し、印刷可能な資料形式で会社に効果的に提案できる状態を実現する。

### 主要機能
- **市場分析ダッシュボード**: 6つの視点で酒類市場を比較分析
- **レポート出力**: PDFレポート自動生成（Noto Sans JPフォント、1ページ1グラフ）
- **データ自動取得**: e-Stat API経由で政府統計データを自動取得
- **CSVインポート**: 補完データの手動インポート対応

## 📖 使い方

### ダッシュボード（トップページ）
1. 画面上部のフィルターで「分析視点」「酒類カテゴリー」「期間」を選択
2. グラフが自動更新され、選択した条件でデータを表示
3. 「更新」ボタンで最新データを取得

### レポート出力
1. ナビゲーションから「レポート出力」をクリック
2. レポートタイトルを入力（必須）
3. 含めるグラフを選択（最大10件）
4. 「プレビュー表示」で確認
5. 「PDF出力」でダウンロード

### CSVインポート
1. レポートページの「CSVインポート」タブを選択
2. 指定フォーマットのCSVファイルをアップロード
3. データがデータベースに追加される

## 🛠 技術スタック

### フロントエンド
- React 18 + TypeScript 5
- Next.js 15 (App Router)
- MUI v6
- Recharts
- Zustand + TanStack Query

### バックエンド
- Next.js 15 (API Routes)
- PostgreSQL (Neon)

### インフラ
- ホスティング: Vercel
- データベース: Neon PostgreSQL

## 📋 ローカル開発

### 必要な外部サービス
1. [e-Stat API](https://www.e-stat.go.jp/api/) - 政府統計データ取得
2. [Neon](https://neon.tech) - PostgreSQLデータベース

### 環境変数設定
`.env.local`ファイルを作成し、以下を設定：
```bash
DATABASE_URL=postgresql://...  # Neon接続URL
ESTAT_API_KEY=...              # e-Stat APIキー
NEXT_PUBLIC_APP_URL=http://localhost:3247
```

### 起動コマンド
```bash
npm install
npm run dev
```

開発サーバー: http://localhost:3247

## 📖 ドキュメント

- [要件定義書](docs/requirements.md)
- [E2Eテスト進捗](docs/SCOPE_PROGRESS.md)
- [プロジェクト設定](CLAUDE.md)

## 🚀 開発フロー

```
Phase 1-9: 実装完了 ✅
Phase 10: 本番デプロイ ✅
Phase 11: 機能拡張（MVP検証後）
```

### 完了済み
- E2Eテスト: 19項目全てPass
- 本番デプロイ: Vercel稼働中
- TypeScriptエラー: 0件

## 📄 ライセンス

このプロジェクトは私的利用を目的としています。
