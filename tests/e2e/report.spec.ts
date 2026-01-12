import { test, expect } from '@playwright/test';

/**
 * P-002: レポート出力 E2Eテスト
 */
test.describe('P-002: レポート出力', () => {
  /**
   * E2E-RPT-001: ページ初期表示テスト
   */
  test('E2E-RPT-001: ページ初期表示', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // 期待結果1: ページタイトルが表示される
    const pageTitle = page.getByRole('heading', { name: 'レポート・データ管理' });
    await expect(pageTitle).toBeVisible({ timeout: 10000 });

    // 期待結果2: レポート設定フォームが表示される
    const settingsHeading = page.getByRole('heading', { name: 'レポート設定' });
    await expect(settingsHeading).toBeVisible();

    // タイトル入力フィールド
    await expect(page.getByText('レポートタイトル').first()).toBeVisible();

    // 期待結果3: タブUIが表示される（レポート出力 / CSVインポート）
    const reportTab = page.getByRole('tab', { name: /レポート/ });
    await expect(reportTab).toBeVisible();

    const csvTab = page.getByRole('tab', { name: /CSV/ });
    await expect(csvTab).toBeVisible();

    // 期待結果4: PDF出力ボタンが表示される
    const pdfButton = page.getByRole('button', { name: /PDF/ });
    await expect(pdfButton).toBeVisible();
  });

  /**
   * E2E-RPT-002: レポートタイトル入力テスト
   */
  test('E2E-RPT-002: レポートタイトル入力', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. タイトル入力フィールドを見つける
    const titleInput = page.locator('input').first();
    await expect(titleInput).toBeVisible();

    // 3. タイトルを入力
    await titleInput.fill('2025年度シードル市場分析');

    // 期待結果1: 入力した値がフィールドに表示される
    await expect(titleInput).toHaveValue('2025年度シードル市場分析');
  });

  /**
   * E2E-RPT-005: CSVインポートタブ切り替えテスト
   */
  test('E2E-RPT-005: CSVインポートタブ切り替え', async ({ page }) => {
    // ビューポートを広げてサイドドロワーとの重なりを避ける
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. 「CSVインポート」タブをクリック（サイドドロワーとの重なりを避けるためforceオプション使用）
    const csvTab = page.getByRole('tab', { name: /CSV/ });
    await expect(csvTab).toBeVisible();

    // フォーカスしてキーボードで操作
    await csvTab.focus();
    await page.keyboard.press('Enter');

    // 期待結果1: CSVインポートパネルが表示される
    await expect(page.getByText(/CSVファイル/).first()).toBeVisible({ timeout: 5000 });

    // 期待結果2: ファイル選択UIが表示される（インポートボタン）
    const importButton = page.getByRole('button', { name: /インポート/ });
    await expect(importButton).toBeVisible();
  });

  /**
   * E2E-RPT-003: グラフ選択テスト
   */
  test('E2E-RPT-003: グラフ選択', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. スクロールしてグラフチェックボックスを見つける
    // VIEW_LABELS: 市場規模推移, 成長率トレンド, 平均価格推移, etc.
    const marketSizeLabel = page.getByText('市場規模推移');
    await expect(marketSizeLabel).toBeVisible({ timeout: 10000 });

    // FormControlLabelの近くにあるチェックボックスをクリック
    const marketSizeCheckbox = page.locator('label', { hasText: '市場規模推移' }).locator('input[type="checkbox"]');
    await marketSizeCheckbox.check();

    // 期待結果1: チェックボックスがチェックされる
    await expect(marketSizeCheckbox).toBeChecked();

    // 3. 成長率トレンドもチェック
    const growthCheckbox = page.locator('label', { hasText: '成長率トレンド' }).locator('input[type="checkbox"]');
    await growthCheckbox.check();

    // 期待結果2: 2つのグラフがチェックされている
    await expect(growthCheckbox).toBeChecked();
    await expect(marketSizeCheckbox).toBeChecked();
  });

  /**
   * E2E-RPT-004: PDF生成・ダウンロードテスト
   * PDF生成のフロー確認（タイトル入力→グラフ選択→プレビュー→PDF出力→ダウンロード確認）
   *
   * テスト目的:
   * - PDF出力ボタンが正しく動作すること
   * - PDF生成処理が完了すること
   * - PDFファイルがダウンロードされること（Playwrightのdownload機能を使用）
   */
  test('E2E-RPT-004: PDF生成・ダウンロード', async ({ page }) => {
    test.setTimeout(180000); // 3分に延長

    // コンソールログ収集
    const consoleLogs: Array<{type: string, text: string}> = [];
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. レポート出力ページへアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. レポートタイトルを入力
    const titleInput = page.locator('input').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('市場分析レポート');
    await expect(titleInput).toHaveValue('市場分析レポート');

    // 3. グラフが選択されていることを確認（Zustand storeの初期値で2つ選択済み）
    const marketSizeCheckbox = page.locator('label', { hasText: '市場規模推移' }).locator('input[type="checkbox"]');
    await expect(marketSizeCheckbox).toBeVisible({ timeout: 10000 });

    // 4. プレビューを表示（これにより内部でAPIリクエストが発生）
    const previewButton = page.getByRole('button', { name: /プレビュー/ });
    await expect(previewButton).toBeVisible();
    await previewButton.click();

    // グラフ描画を待機（Rechartsのグラフが表示されるまで）
    await expect(page.locator('.recharts-wrapper svg path').first()).toBeVisible({ timeout: 30000 });

    // 追加の安定化待機（レンダリング完了を待つ）
    await page.waitForTimeout(2000);

    // 5. PDF出力ボタンを確認
    const pdfButton = page.getByRole('button', { name: /PDF出力/ });
    await expect(pdfButton).toBeVisible();

    // PDF出力ボタンが有効になるまで待機
    await expect(pdfButton).toBeEnabled({ timeout: 10000 });

    // 6. ダウンロードイベントを待機しながらPDFボタンをクリック
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await pdfButton.click();

    // 生成中の表示を確認（プロセスが開始されたことを確認）
    const generatingText = page.getByText(/生成中|キャプチャ中/).first();
    await expect(generatingText).toBeVisible({ timeout: 10000 });

    // 7. ダウンロード完了を待機
    const download = await downloadPromise;

    // 期待結果: PDFファイルがダウンロードされる
    // ファイル名の確認（report_YYYYMMDD.pdf形式）
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toMatch(/^report_\d{8}\.pdf$/);

    // ダウンロードされたファイルが存在することを確認
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // コンソールログ出力（デバッグ用）
    console.log('=== Browser Console Logs ===');
    consoleLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));
  });

  /**
   * E2E-RPT-008: タイトル未入力でのPDF生成テスト（異常系）
   */
  test('E2E-RPT-008: タイトル未入力でのPDF生成', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. タイトルを空のまま（デフォルトで空）
    const titleInput = page.locator('input').first();
    await expect(titleInput).toBeVisible();
    await titleInput.clear();

    // 3. グラフを1つ選択
    const marketSizeCheckbox = page.locator('label', { hasText: '市場規模推移' }).locator('input[type="checkbox"]');
    await expect(page.getByText('市場規模推移')).toBeVisible({ timeout: 10000 });
    await marketSizeCheckbox.check();

    // 4. PDF出力ボタンを確認
    const pdfButton = page.getByRole('button', { name: /PDF/ });
    await expect(pdfButton).toBeVisible();

    // 期待結果: PDF出力ボタンが無効化されている
    await expect(pdfButton).toBeDisabled();
  });

  /**
   * E2E-RPT-009: グラフ未選択でのPDF生成テスト（異常系）
   * グラフが1つも選択されていない場合、PDF出力ボタンが無効化されることを確認
   */
  test('E2E-RPT-009: グラフ未選択でのPDF生成', async ({ page }) => {
    // ビューポートをさらに広げてサイドドロワーとの重なりを完全に避ける
    await page.setViewportSize({ width: 1800, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. タイトルを入力
    const titleInput = page.locator('input').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('テストレポート');

    // 3. 初期状態で選択されているグラフ（市場規模推移、成長率トレンド）を明示的に外す
    // MUIのFormControlLabel全体をクリックして切り替える
    const marketSizeLabel = page.locator('.MuiFormControlLabel-root', { hasText: '市場規模推移' });
    const growthLabel = page.locator('.MuiFormControlLabel-root', { hasText: '成長率トレンド' });

    // 市場規模推移のラベルをクリックしてチェックを外す
    await expect(marketSizeLabel).toBeVisible();
    await marketSizeLabel.click();

    // 成長率トレンドのラベルをクリックしてチェックを外す
    await expect(growthLabel).toBeVisible();
    await growthLabel.click();

    // 状態が反映されるのを待機
    await page.waitForTimeout(500);

    // 4. チェックボックスの状態を確認
    const marketSizeCheckbox = page.locator('label', { hasText: '市場規模推移' }).locator('input[type="checkbox"]');
    const growthCheckbox = page.locator('label', { hasText: '成長率トレンド' }).locator('input[type="checkbox"]');

    await expect(marketSizeCheckbox).not.toBeChecked();
    await expect(growthCheckbox).not.toBeChecked();

    // 5. PDF出力ボタンを確認
    const pdfButton = page.getByRole('button', { name: /PDF出力/ });
    await expect(pdfButton).toBeVisible();

    // 期待結果: グラフ未選択のためPDF出力ボタンが無効化されている
    await expect(pdfButton).toBeDisabled();
  });

  /**
   * E2E-RPT-006: CSVファイルアップロードテスト
   */
  test('E2E-RPT-006: CSVファイルアップロード', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report?tab=import` にアクセス（CSVインポートタブ直接開く）
    await page.goto('/report?tab=import');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // CSVインポートタブに切り替え
    const csvTab = page.getByRole('tab', { name: /CSV/ });
    await csvTab.focus();
    await page.keyboard.press('Enter');

    // CSVインポートパネルが表示されるまで待機
    await expect(page.getByText('CSVデータインポート')).toBeVisible({ timeout: 5000 });

    // 2. テスト用CSVファイルを選択
    // ファイルインプットを取得
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles('./tests/fixtures/test-valid.csv');

    // ファイル名が表示されることを確認
    await expect(page.getByText('test-valid.csv')).toBeVisible({ timeout: 5000 });

    // 3. 「インポート実行」ボタンをクリック
    const importButton = page.getByRole('button', { name: /インポート実行/ });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
    await importButton.click();

    // 期待結果: インポート処理が実行され結果が表示される
    // 成功またはエラーの結果アラートが表示される
    const resultAlert = page.locator('.MuiAlert-root').filter({ hasText: /インポート|エラー/ });
    await expect(resultAlert).toBeVisible({ timeout: 30000 });
  });

  /**
   * E2E-RPT-007: ダッシュボードへの戻りテスト
   */
  test('E2E-RPT-007: ダッシュボードへの戻り', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report` にアクセス
    await page.goto('/report');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // 2. サイドバーの「市場分析ダッシュボード」リンクをクリック
    // Next.js Linkコンポーネントを使用しているため、role="link"で取得
    const dashboardLink = page.getByRole('link', { name: '市場分析ダッシュボード' });
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();

    // 期待結果: `/` ページに遷移する（/report を含まないURLに変わる）
    // URLがルートパス（'/'で終わりかつ'/report'を含まない）になるまで待機
    await page.waitForURL((url) => {
      const pathname = url.pathname;
      return pathname === '/' || (pathname.endsWith('/') && !pathname.includes('/report'));
    }, { timeout: 15000 });

    // ダッシュボードのタイトルが表示される
    const pageTitle = page.getByRole('heading', { name: /市場分析ダッシュボード/ });
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  /**
   * E2E-RPT-010: 不正なCSVファイルのアップロードテスト（異常系）
   */
  test('E2E-RPT-010: 不正なCSVファイルのアップロード', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1600, height: 900 });

    // 1. `/report?tab=import` にアクセス（CSVインポートタブ直接開く）
    await page.goto('/report?tab=import');
    await page.waitForLoadState('networkidle');

    // ページ読み込み完了を待機
    await expect(page.getByRole('heading', { name: 'レポート・データ管理' })).toBeVisible({
      timeout: 10000,
    });

    // CSVインポートタブに切り替え
    const csvTab = page.getByRole('tab', { name: /CSV/ });
    await csvTab.focus();
    await page.keyboard.press('Enter');

    // CSVインポートパネルが表示されるまで待機
    await expect(page.getByText('CSVデータインポート')).toBeVisible({ timeout: 5000 });

    // 既存のアラートが消えるまで待機
    await page.waitForTimeout(1000);

    // 2. 不正な形式のCSVファイルを選択
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles('./tests/fixtures/test-invalid.csv');

    // ファイル名が表示されることを確認
    await expect(page.getByText('test-invalid.csv')).toBeVisible({ timeout: 5000 });

    // 3. 「インポート実行」ボタンをクリック
    const importButton = page.getByRole('button', { name: /インポート実行/ });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
    await importButton.click();

    // 期待結果: エラーアラートが表示される
    // 不正なヘッダーの場合: 「必須ヘッダーが不足しています」または400エラー
    // APIエラーの場合: 「インポート中にエラーが発生しました」
    // エラーを示すアラートを待機（error severity または エラー内容を含むアラート）
    const errorIndicator = page.locator('.MuiAlert-root').filter({
      hasText: /error|エラー|failed|400/i
    });
    await expect(errorIndicator.first()).toBeVisible({ timeout: 30000 });
  });
});
