# E2Eテスト ベストプラクティス

**プロジェクト**: シードル市場分析ダッシュボード
**作成日時**: 2026-01-11
**目的**: E2Eテストで成功したパターンを蓄積し、後続テストの試行錯誤を削減

---

## 1. サーバー起動

### 成功パターン
- (まだ蓄積なし)

### 注意点
- Next.js開発サーバーはポート3247で起動
- サーバー起動後、ヘルスチェック(`/api/health`)で準備完了を確認

---

## 2. ページアクセス

### 成功パターン
- (まだ蓄積なし)

### 注意点
- P-001: 市場分析ダッシュボード → `/`
- P-002: レポート出力 → `/report`

---

## 3. 認証処理

### 成功パターン
- (認証不要 - MVPはゲストアクセス)

### 注意点
- MVP版では認証機能なし

---

## 4. UI操作

### 成功パターン
- (まだ蓄積なし)

### 注意点
- MUI v6コンポーネントを使用
- フィルターパネル: カテゴリー選択、期間選択
- グラフ: Rechartsで描画

---

## 5. データ取得・表示

### 成功パターン
- (まだ蓄積なし)

### 注意点
- TanStack Query v5でデータ取得
- ローディング状態: スケルトン表示
- エラー状態: アラート表示

---

## 6. PDF生成

### 成功パターン
- (まだ蓄積なし)

### 注意点
- html2canvas + @react-pdf/renderer
- アニメーション無効化が必要

---

## 7. CSVインポート

### 成功パターン
- (まだ蓄積なし)

### 注意点
- フォーマット: category, year_month, value, data_type
- 許可カテゴリーのバリデーションあり

---

## 8. 共通セレクター

### MUIコンポーネント
```typescript
// ボタン
page.getByRole('button', { name: /ボタン名/ })

// MUI Selectのラベル（複数要素にマッチするので.first()必須）
page.getByText('ラベル名').first()

// 日付入力フィールド（type="month"）のラベル
page.getByText('開始年月').first()

// タブ
page.getByRole('tab', { name: 'タブ名' })

// 見出し（正規表現で部分一致推奨）
page.getByRole('heading', { name: /タイトル/ })
```

### カスタムセレクター
```typescript
// data-testid属性を使用（推奨）
page.getByTestId('chart-container')
```

### ⚠️ MUI v6での注意点
- MUIのSelectコンポーネントはlabelとspan両方にテキストが存在する
- `getByLabel()`ではなく`getByText().first()`を使用
- 正規表現で部分一致させると柔軟性が上がる

### MUI Select操作パターン（サイドドロワーと重なる場合）
```typescript
// フォーカスしてキーボードでドロップダウンを開く
const selectCombobox = page.locator('[role="combobox"]').first();
await selectCombobox.focus();
await page.keyboard.press('Space');

// ドロップダウンメニューが開くのを待機
await page.waitForSelector('[role="listbox"]', { state: 'visible' });

// オプションをクリックで選択
const option = page.getByRole('option', { name: 'オプション名' });
await option.click();

// 選択確認
await expect(selectCombobox).toHaveText('オプション名');
```

### MUI Multiple Select操作パターン
```typescript
// 2番目のcombobox（酒類カテゴリー）を取得
const categorySelect = page.locator('[role="combobox"]').nth(1);
await categorySelect.focus();
await page.keyboard.press('Space');

// オプションを複数選択（トグル動作）
await page.getByRole('option', { name: 'ワイン' }).click();
await page.getByRole('option', { name: '日本酒' }).click();

// Escでドロップダウンを閉じる
await page.keyboard.press('Escape');
await page.waitForSelector('[role="listbox"]', { state: 'hidden' });

// 選択されたチップの数で検証（テキスト検証はフォント問題で不安定）
const chips = categorySelect.locator('.MuiChip-root');
await expect(chips).toHaveCount(2);
```

---

## 9. 待機パターン

### 成功パターン
```typescript
// APIレスポンス待機
await page.waitForResponse(resp =>
  resp.url().includes('/api/market-data') &&
  resp.status() === 200
);

// 要素表示待機
await expect(page.getByTestId('chart')).toBeVisible();

// ローディング完了待機
await page.waitForSelector('[data-loading="false"]');
```

---

## 更新履歴

| 日時 | テストID | 追加内容 |
|------|----------|----------|
| 2026-01-11 | E2E-DASH-003 | MUI Select操作パターン（キーボード操作）追加 |
| 2026-01-11 | E2E-DASH-001 | MUI v6セレクター注意点、.first()パターン追加 |
| - | - | 初期テンプレート作成 |
