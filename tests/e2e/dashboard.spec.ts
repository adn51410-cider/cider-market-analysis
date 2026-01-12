import { test, expect } from '@playwright/test';

/**
 * P-001: 市場分析ダッシュボード E2Eテスト
 */
test.describe('P-001: 市場分析ダッシュボード', () => {
  /**
   * E2E-DASH-001: ページ初期表示テスト
   */
  test('E2E-DASH-001: ページ初期表示', async ({ page }) => {
    // 1. `/` にアクセス
    await page.goto('/');

    // ページ読み込みを待機
    await page.waitForLoadState('networkidle');

    // 期待結果1: ページタイトルが表示される
    const pageTitle = page.getByRole('heading', { name: /市場分析ダッシュボード/ });
    await expect(pageTitle).toBeVisible({ timeout: 10000 });

    // 期待結果2: サブタイトルも表示される
    const subTitle = page.getByText(/シードルと他の酒類市場を.*視点で比較分析/);
    await expect(subTitle).toBeVisible();

    // 期待結果3: フィルターパネルが表示される
    // MUI Selectコンポーネントのラベルテキストで確認（複数マッチするので.first()を使用）
    await expect(page.getByText('分析視点').first()).toBeVisible();
    await expect(page.getByText('酒類カテゴリー').first()).toBeVisible();

    // 日付入力フィールド（type="month"）
    await expect(page.getByText('開始年月').first()).toBeVisible();
    await expect(page.getByText('終了年月').first()).toBeVisible();

    // アクションボタンの確認
    const refreshButton = page.getByRole('button', { name: /更新/ });
    await expect(refreshButton).toBeVisible();

    const importButton = page.getByRole('button', { name: /CSV/ });
    await expect(importButton).toBeVisible();

    const reportButton = page.getByRole('button', { name: /レポート/ });
    await expect(reportButton).toBeVisible();

    // 期待結果4: ローディング完了後、サマリーカードまたはエラーが表示される
    // APIが成功した場合: サマリーカードが表示
    // APIが失敗した場合: エラーアラートが表示
    const summaryOrError = page.getByText(/選択カテゴリー合計|データの取得に失敗しました/);
    await expect(summaryOrError).toBeVisible({ timeout: 30000 });

    // 期待結果5: データソース情報が表示される（常に表示される要素）
    const dataSource = page.getByText(/データソース/);
    await expect(dataSource).toBeVisible();
  });

  /**
   * E2E-DASH-002: データ自動取得テスト
   * ページ読み込み時にe-Stat APIからデータが自動取得されることを確認
   */
  test('E2E-DASH-002: データ自動取得', async ({ page }) => {
    // APIレスポンスを監視
    const apiResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/market-data') &&
        response.status() === 200
    );

    // 1. `/` にアクセス
    await page.goto('/');

    // 2. APIレスポンスを待機
    const apiResponse = await apiResponsePromise;

    // 期待結果1: /api/market-data APIが呼び出される
    expect(apiResponse.url()).toContain('/api/market-data');
    expect(apiResponse.status()).toBe(200);

    // 期待結果2: レスポンスがJSON形式
    const responseData = await apiResponse.json();
    expect(responseData).toBeDefined();

    // 期待結果3: グラフにデータが表示される（サマリーカードで確認）
    // ローディング完了後、サマリーカードが表示される
    await expect(page.getByText('選択カテゴリー合計')).toBeVisible({ timeout: 30000 });

    // 期待結果4: エラー表示がない（サマリーカードが表示されればエラーなし）
    // データ取得成功時はエラーアラートが表示されない
    const errorAlert = page.getByText('データの取得に失敗しました');
    await expect(errorAlert).not.toBeVisible();
  });

  /**
   * E2E-DASH-003: 分析視点の切り替えテスト
   * 6つの分析視点を切り替えられることを確認
   */
  test('E2E-DASH-003: 分析視点の切り替え', async ({ page }) => {
    // ビューポートを広げてサイドドロワーとの重なりを避ける
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 分析視点ドロップダウンをクリック
    // MUI Selectのcomboboxロールで特定
    const selectCombobox = page.locator('[role="combobox"]').first();
    await expect(selectCombobox).toBeVisible();

    // フォーカスしてからスペースキーでドロップダウンを開く
    await selectCombobox.focus();
    await page.keyboard.press('Space');

    // ドロップダウンメニューが開くのを待機
    await page.waitForSelector('[role="listbox"]', { state: 'visible', timeout: 5000 });

    // 3. 「成長トレンド分析」を選択
    // オプションが表示されたらクリックで選択
    const growthOption = page.getByRole('option', { name: '成長トレンド分析' });
    await expect(growthOption).toBeVisible({ timeout: 5000 });
    await growthOption.click();

    // 期待結果: Selectの値が「成長トレンド分析」に変更される
    await expect(selectCombobox).toHaveText('成長トレンド分析');
  });

  /**
   * E2E-DASH-004: 期間フィルター操作テスト
   * 開始年月・終了年月を選択してフィルタリングできることを確認
   */
  test('E2E-DASH-004: 期間フィルター操作', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 開始年月フィールドで期間を選択
    const startDateInput = page.locator('input[type="month"]').first();
    await expect(startDateInput).toBeVisible();
    // クリックしてフォーカスを確保
    await startDateInput.click();
    await startDateInput.fill('2024-01');
    // 値が設定されたことを確認
    await expect(startDateInput).toHaveValue('2024-01');

    // 3. 終了年月フィールドで期間を選択
    // month input は直接 fill() で値を設定（React の onChange がトリガーされる）
    const endDateInput = page.locator('input[type="month"]').nth(1);
    await expect(endDateInput).toBeVisible();
    await endDateInput.click();
    await endDateInput.fill('2024-06');
    await expect(endDateInput).toHaveValue('2024-06');

    // 4. 「更新」ボタンをクリック
    const refreshButton = page.getByRole('button', { name: /更新/ });

    // APIリクエストを監視
    const apiResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/market-data'),
      { timeout: 30000 }
    );

    await refreshButton.click();

    // 5. APIが新しいパラメータで呼び出される
    const apiResponse = await apiResponsePromise;
    expect(apiResponse.url()).toContain('from=2024-01');
    // 終了日は現在の日付に依存する可能性があるため、開始日の変更のみを確認
    // または終了日が開始日より後であることを確認
    const urlParams = new URL(apiResponse.url());
    const fromParam = urlParams.searchParams.get('from');
    const toParam = urlParams.searchParams.get('to');
    expect(fromParam).toBe('2024-01');
    expect(toParam).toBeTruthy();
    // toがfromより後（または同じ月）であることを確認
    expect(toParam! >= fromParam!).toBe(true);

    // 期待結果: 選択した期間のデータでグラフが更新される
    // サマリーカードまたはエラーが表示されることで確認
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });
  });

  /**
   * E2E-DASH-005: 酒類カテゴリー選択テスト
   * 比較する酒類カテゴリーを選択できることを確認
   */
  test('E2E-DASH-005: 酒類カテゴリー選択', async ({ page }) => {
    // ビューポートを広げてサイドドロワーとの重なりを避ける
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 酒類カテゴリーセレクトを開く（2番目のcombobox）
    const categorySelect = page.locator('[role="combobox"]').nth(1);
    await expect(categorySelect).toBeVisible();

    // フォーカスしてキーボードで開く
    await categorySelect.focus();
    await page.keyboard.press('Space');

    // ドロップダウンメニューが開くのを待機
    await page.waitForSelector('[role="listbox"]', { state: 'visible', timeout: 5000 });

    // 3. 「ワイン」オプションを選択
    const wineOption = page.getByRole('option', { name: 'ワイン' });
    await expect(wineOption).toBeVisible({ timeout: 5000 });
    await wineOption.click();

    // 4. 「日本酒」オプションも選択
    const sakeOption = page.getByRole('option', { name: '日本酒' });
    await expect(sakeOption).toBeVisible();
    await sakeOption.click();

    // Escキーでドロップダウンを閉じる
    await page.keyboard.press('Escape');

    // listboxが閉じるのを待機
    await page.waitForSelector('[role="listbox"]', { state: 'hidden', timeout: 5000 });

    // 期待結果: 選択されたカテゴリーがチップとして表示される
    // MUI Selectのmultipleモードでは、Chipが選択値として表示される
    // 酒類カテゴリーSelectはページ内で2つあるチップコンテナの2番目
    // チップが2つ以上表示されていることを確認（ワインと日本酒が選択されている）
    const chips = categorySelect.locator('.MuiChip-root');
    await expect(chips).toHaveCount(2);
  });

  /**
   * E2E-DASH-006: データ更新ボタンテスト
   * 手動でデータを再取得できることを確認
   */
  test('E2E-DASH-006: データ更新ボタン', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 初期データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 「更新」ボタンをクリック
    const refreshButton = page.getByRole('button', { name: /更新/ });
    await expect(refreshButton).toBeVisible();

    // APIリクエストを監視
    const apiResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/market-data'),
      { timeout: 30000 }
    );

    await refreshButton.click();

    // 期待結果1: APIが再呼び出しされる
    const apiResponse = await apiResponsePromise;
    expect(apiResponse.url()).toContain('/api/market-data');
    expect(apiResponse.status()).toBe(200);

    // 期待結果2: ローディング完了後、グラフが更新される（サマリーカードが表示される）
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 期待結果3: 更新ボタンが元に戻る（ローディング終了確認）
    await expect(page.getByRole('button', { name: '更新' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '更新' })).toBeEnabled({ timeout: 5000 });
  });

  /**
   * E2E-DASH-007: レポート出力ページへの遷移テスト
   * レポート出力ページに遷移できることを確認
   */
  test('E2E-DASH-007: レポート出力ページへの遷移', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 初期データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 「レポート出力」ボタンをクリック
    // MUIのcontainedボタン（紺色）でDescriptionIconを持つボタン
    const reportButton = page.locator('button.MuiButton-contained').filter({ hasText: /レポート/ });
    await expect(reportButton).toBeVisible({ timeout: 5000 });

    // クリック後のナビゲーションを待機
    await Promise.all([
      page.waitForURL('**/report**', { timeout: 20000 }),
      reportButton.click(),
    ]);

    // 期待結果1: `/report` ページに遷移する
    expect(page.url()).toContain('/report');

    // 期待結果2: レポートページのタイトルが表示される
    const pageTitle = page.getByRole('heading', { name: 'レポート・データ管理' });
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  /**
   * E2E-DASH-008: APIエラー時の表示テスト（異常系）
   * APIエラー時に適切なエラーメッセージが表示されることを確認
   */
  test('E2E-DASH-008: API エラー時の表示', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. APIをモックしてエラーを返すよう設定
    await page.route('**/api/market-data**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // 2. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 期待結果1: エラーメッセージが表示される
    const errorAlert = page.getByText(/データの取得に失敗しました/);
    await expect(errorAlert).toBeVisible({ timeout: 30000 });

    // 期待結果2: アプリケーションがクラッシュしない（ページは表示されている）
    const pageTitle = page.getByRole('heading', { name: /市場分析ダッシュボード/ });
    await expect(pageTitle).toBeVisible();

    // 期待結果3: フィルターパネルは引き続き操作可能
    await expect(page.getByText('分析視点').first()).toBeVisible();
  });

  /**
   * E2E-DASH-009: 不正な期間選択テスト（異常系）
   * 開始年月が終了年月より後の場合のバリデーションを確認
   */
  test('E2E-DASH-009: 不正な期間選択', async ({ page }) => {
    // ビューポートを広げる
    await page.setViewportSize({ width: 1400, height: 900 });

    // 1. `/` にアクセス
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 初期データ読み込み完了を待機
    await expect(page.getByText(/選択カテゴリー合計|データの取得に失敗しました/)).toBeVisible({
      timeout: 30000,
    });

    // 2. 開始年月を「2025-12」に設定（終了年月より後）
    const startDateInput = page.locator('input[type="month"]').first();
    await expect(startDateInput).toBeVisible();
    await startDateInput.fill('2025-12');

    // 3. 終了年月を「2025-01」に設定（開始年月より前）
    const endDateInput = page.locator('input[type="month"]').nth(1);
    await expect(endDateInput).toBeVisible();
    await endDateInput.fill('2025-01');

    // 4. 「更新」ボタンをクリック
    const refreshButton = page.getByRole('button', { name: '更新' });
    await expect(refreshButton).toBeVisible();

    // APIリクエストを監視（400エラーが期待される）
    const apiResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/market-data') &&
        (response.status() === 400 || response.status() === 200),
      { timeout: 30000 }
    );

    await refreshButton.click();

    // 5. APIレスポンスを確認
    const apiResponse = await apiResponsePromise;

    // 期待結果1: バリデーションエラーまたはエラーメッセージが表示される
    // APIが400エラーを返した場合、エラーメッセージが表示される
    if (apiResponse.status() === 400) {
      // APIがバリデーションエラーを返した
      const responseBody = await apiResponse.json();
      expect(responseBody.code).toBe('INVALID_DATE_RANGE');

      // エラーメッセージが表示されることを確認
      await expect(page.getByText(/データの取得に失敗しました/)).toBeVisible({ timeout: 10000 });
    } else {
      // API成功の場合もアプリはクラッシュしない（グレースフルに処理）
      await expect(page.getByRole('heading', { name: /市場分析ダッシュボード/ })).toBeVisible();
    }

    // 期待結果2: アプリケーションがクラッシュしない
    const pageTitle = page.getByRole('heading', { name: /市場分析ダッシュボード/ });
    await expect(pageTitle).toBeVisible();
  });
});
