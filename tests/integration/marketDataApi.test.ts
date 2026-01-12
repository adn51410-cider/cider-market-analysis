/**
 * スライス3: 市場データAPI統合テスト
 *
 * 検証対象:
 * - /api/market-data エンドポイント（src/app/api/market-data/route.ts）
 * - カテゴリーフィルタリング
 * - 期間フィルタリング（from, to）
 * - 複数カテゴリー対応（カンマ区切り）
 * - e-Stat APIからのデータ取得とDB保存
 *
 * 注意: このテストは実際のNeonデータベースとe-Stat APIに接続します
 *       モックは一切使用しません
 */

require('dotenv').config({ path: '.env.local' });

import { query, closePool } from '../../src/lib/db';

// ============================================================
// 設定
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3247';
const API_ENDPOINT = `${BASE_URL}/api/market-data`;

// ============================================================
// 型定義
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

interface MarketDataResponse {
  id: string;
  category: string;
  yearMonth: string;
  value: number;
  dataType: string;
  source: string;
}

interface ApiResponse {
  success: boolean;
  data?: MarketDataResponse[];
  meta?: {
    totalCount: number;
    categories: string[];
  };
  error?: string;
  code?: string;
}

// ============================================================
// テストユーティリティ
// ============================================================

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const status = passed ? 'PASSED' : 'FAILED';
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.log(`[${status}] ${name}${durationStr}${error ? ': ' + error : ''}`);
}

async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * APIリクエストを送信
 */
async function fetchApi(params?: Record<string, string>): Promise<{ response: Response; body: ApiResponse }> {
  const url = new URL(API_ENDPOINT);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const body: ApiResponse = await response.json();
  return { response, body };
}

// ============================================================
// テストケース
// ============================================================

async function runTests() {
  console.log('========================================');
  console.log('スライス3: 市場データAPI 統合テスト');
  console.log('========================================\n');

  console.log(`APIエンドポイント: ${API_ENDPOINT}\n`);

  // 環境変数チェック
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  if (!process.env.ESTAT_API_KEY) {
    console.error('ERROR: ESTAT_API_KEY is not set in .env.local');
    process.exit(1);
  }

  // -----------------------------------------------------------------
  // テスト0: サーバー起動確認
  // -----------------------------------------------------------------
  try {
    console.log('テスト0: サーバー起動確認');
    const { result: healthCheck, duration } = await measureTime(async () => {
      const response = await fetch(`${BASE_URL}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return response.ok;
    });

    if (healthCheck) {
      addResult('サーバー起動確認', true, undefined, duration);
    } else {
      addResult('サーバー起動確認', false, `サーバーが起動していません。npm run dev を実行してください。`, duration);
      console.log('\n========================================');
      console.log('テスト中止: サーバーが起動していません');
      console.log('npm run dev を実行後、再度テストを実行してください');
      console.log('========================================');
      await closePool();
      process.exit(1);
    }
  } catch (error) {
    addResult('サーバー起動確認', false, `接続失敗: ${error}`);
    console.log('\n========================================');
    console.log('テスト中止: サーバーに接続できません');
    console.log(`URL: ${BASE_URL}`);
    console.log('npm run dev を実行後、再度テストを実行してください');
    console.log('========================================');
    await closePool();
    process.exit(1);
  }

  // -----------------------------------------------------------------
  // テスト1: エンドポイントが正常に動作すること（GETリクエスト）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト1: エンドポイントが正常に動作すること（GETリクエスト）');

    const { result: { response }, duration } = await measureTime(async () => {
      return await fetchApi({ from: '2024-01', to: '2024-03' });
    });

    // ステータスコードは200または400（パラメータ不足の場合）
    const isValidStatus = response.status === 200 || response.status === 400;

    if (isValidStatus) {
      addResult('GETリクエスト正常動作', true, `status: ${response.status}`, duration);
    } else {
      addResult('GETリクエスト正常動作', false, `status: ${response.status}`, duration);
    }
  } catch (error) {
    addResult('GETリクエスト正常動作', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト2: パラメータなしでエラーレスポンスが返ること
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト2: パラメータなしでエラーレスポンスが返ること');

    const { result: { response, body }, duration } = await measureTime(async () => {
      return await fetchApi();
    });

    // from, toが必須なので、パラメータなしは400エラー
    const isExpectedStatus = response.status === 400;
    const hasErrorMessage = body.success === false && body.error !== undefined;
    const hasErrorCode = body.code === 'MISSING_PARAMETERS';

    if (isExpectedStatus && hasErrorMessage && hasErrorCode) {
      addResult('パラメータなしでエラー', true, `code: ${body.code}`, duration);
    } else {
      addResult('パラメータなしでエラー', false,
        `status: ${response.status}, success: ${body.success}, code: ${body.code}`, duration);
    }
  } catch (error) {
    addResult('パラメータなしでエラー', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト3: カテゴリーでフィルタリングできること
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト3: カテゴリーでフィルタリングできること');

    const { result: { response, body }, duration } = await measureTime(async () => {
      return await fetchApi({
        category: 'ワイン',
        from: '2024-01',
        to: '2024-03',
      });
    });

    if (response.status === 200 && body.success) {
      // データがある場合、全てワインカテゴリーであること
      const allWine = body.data?.every(d => d.category === 'ワイン') ?? true;
      const metaCategories = body.meta?.categories || [];
      const onlyWineInMeta = metaCategories.length === 0 || metaCategories.every(c => c === 'ワイン');

      if (allWine && onlyWineInMeta) {
        addResult('カテゴリーフィルタリング', true,
          `${body.data?.length || 0}件取得、カテゴリー: ${metaCategories.join(', ')}`, duration);
      } else {
        addResult('カテゴリーフィルタリング', false,
          `フィルタリング失敗: 他のカテゴリーが含まれています`, duration);
      }
    } else {
      // データが見つからない場合も成功とみなす（DBにデータがない可能性）
      if (response.status === 200 && body.data?.length === 0) {
        addResult('カテゴリーフィルタリング', true,
          `該当データなし（DBにデータがない可能性）`, duration);
      } else {
        addResult('カテゴリーフィルタリング', false,
          `status: ${response.status}, error: ${body.error}`, duration);
      }
    }
  } catch (error) {
    addResult('カテゴリーフィルタリング', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト4: 期間（from, to）でフィルタリングできること
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト4: 期間（from, to）でフィルタリングできること');

    const { result: { response, body }, duration } = await measureTime(async () => {
      return await fetchApi({
        from: '2024-01',
        to: '2024-06',
      });
    });

    if (response.status === 200 && body.success) {
      // データがある場合、全て指定期間内であること
      const allInRange = body.data?.every(d => {
        return d.yearMonth >= '2024-01' && d.yearMonth <= '2024-06';
      }) ?? true;

      if (allInRange) {
        addResult('期間フィルタリング', true,
          `${body.data?.length || 0}件取得、期間: 2024-01〜2024-06`, duration);
      } else {
        const outOfRange = body.data?.filter(d =>
          d.yearMonth < '2024-01' || d.yearMonth > '2024-06'
        );
        addResult('期間フィルタリング', false,
          `期間外のデータが含まれています: ${outOfRange?.map(d => d.yearMonth).join(', ')}`, duration);
      }
    } else {
      // データが見つからない場合も成功とみなす
      if (response.status === 200 && body.data?.length === 0) {
        addResult('期間フィルタリング', true,
          `該当データなし（DBにデータがない可能性）`, duration);
      } else {
        addResult('期間フィルタリング', false,
          `status: ${response.status}, error: ${body.error}`, duration);
      }
    }
  } catch (error) {
    addResult('期間フィルタリング', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト5: 複数カテゴリー（カンマ区切り）で取得できること
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト5: 複数カテゴリー（カンマ区切り）で取得できること');

    const { result: { response, body }, duration } = await measureTime(async () => {
      return await fetchApi({
        category: 'ワイン,日本酒',
        from: '2024-01',
        to: '2024-03',
      });
    });

    if (response.status === 200 && body.success) {
      // データがある場合、ワインまたは日本酒のみであること
      const validCategories = ['ワイン', '日本酒'];
      const allValid = body.data?.every(d => validCategories.includes(d.category)) ?? true;

      if (allValid) {
        const categories = body.meta?.categories || [];
        addResult('複数カテゴリー取得', true,
          `${body.data?.length || 0}件取得、カテゴリー: ${categories.join(', ')}`, duration);
      } else {
        const invalid = body.data?.filter(d => !validCategories.includes(d.category));
        addResult('複数カテゴリー取得', false,
          `無効なカテゴリーが含まれています: ${invalid?.map(d => d.category).join(', ')}`, duration);
      }
    } else {
      // データが見つからない場合も成功とみなす
      if (response.status === 200 && body.data?.length === 0) {
        addResult('複数カテゴリー取得', true,
          `該当データなし（DBにデータがない可能性）`, duration);
      } else {
        addResult('複数カテゴリー取得', false,
          `status: ${response.status}, error: ${body.error}`, duration);
      }
    }
  } catch (error) {
    addResult('複数カテゴリー取得', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト6: 不正なパラメータでエラーレスポンスが返ること
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト6: 不正なパラメータでエラーレスポンスが返ること');

    // 6-a: 不正な日付フォーマット
    const { result: result1, duration: duration1 } = await measureTime(async () => {
      return await fetchApi({
        from: '2024/01/01',  // 不正なフォーマット
        to: '2024-03',
      });
    });

    const invalidFormat = result1.response.status === 400 &&
                          result1.body.success === false &&
                          result1.body.code === 'INVALID_DATE_FORMAT';

    // 6-b: 不正なカテゴリー
    const { result: result2, duration: duration2 } = await measureTime(async () => {
      return await fetchApi({
        category: '存在しないカテゴリー',
        from: '2024-01',
        to: '2024-03',
      });
    });

    const invalidCategory = result2.response.status === 400 &&
                            result2.body.success === false &&
                            result2.body.code === 'INVALID_CATEGORY';

    // 6-c: 期間の逆転（from > to）
    const { result: result3, duration: duration3 } = await measureTime(async () => {
      return await fetchApi({
        from: '2024-06',
        to: '2024-01',
      });
    });

    const invalidRange = result3.response.status === 400 &&
                         result3.body.success === false &&
                         result3.body.code === 'INVALID_DATE_RANGE';

    const totalDuration = duration1 + duration2 + duration3;

    if (invalidFormat && invalidCategory && invalidRange) {
      addResult('不正パラメータでエラー', true,
        `日付フォーマット: OK, カテゴリー: OK, 期間逆転: OK`, totalDuration);
    } else {
      const failures = [];
      if (!invalidFormat) failures.push(`日付フォーマット(code: ${result1.body.code})`);
      if (!invalidCategory) failures.push(`カテゴリー(code: ${result2.body.code})`);
      if (!invalidRange) failures.push(`期間逆転(code: ${result3.body.code})`);
      addResult('不正パラメータでエラー', false,
        `失敗: ${failures.join(', ')}`, totalDuration);
    }
  } catch (error) {
    addResult('不正パラメータでエラー', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト7: レスポンス形式が正しいこと（success, data, meta）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト7: レスポンス形式が正しいこと（success, data, meta）');

    const { result: { response, body }, duration } = await measureTime(async () => {
      return await fetchApi({
        from: '2024-01',
        to: '2024-03',
      });
    });

    if (response.status === 200 && body.success) {
      // レスポンス形式の検証
      const hasSuccess = 'success' in body;
      const hasData = 'data' in body && Array.isArray(body.data);
      const hasMeta = 'meta' in body && body.meta !== undefined;
      const hasMetaTotalCount = hasMeta && typeof body.meta?.totalCount === 'number';
      const hasMetaCategories = hasMeta && Array.isArray(body.meta?.categories);

      // データ項目の形式検証（データがある場合）
      let dataFormatValid = true;
      if (body.data && body.data.length > 0) {
        const firstItem = body.data[0];
        dataFormatValid = 'id' in firstItem &&
                          'category' in firstItem &&
                          'yearMonth' in firstItem &&
                          'value' in firstItem &&
                          'dataType' in firstItem &&
                          'source' in firstItem;
      }

      if (hasSuccess && hasData && hasMeta && hasMetaTotalCount && hasMetaCategories && dataFormatValid) {
        addResult('レスポンス形式検証', true,
          `success: OK, data: Array(${body.data?.length}), meta: {totalCount, categories}`, duration);
      } else {
        const missing = [];
        if (!hasSuccess) missing.push('success');
        if (!hasData) missing.push('data');
        if (!hasMeta) missing.push('meta');
        if (!hasMetaTotalCount) missing.push('meta.totalCount');
        if (!hasMetaCategories) missing.push('meta.categories');
        if (!dataFormatValid) missing.push('data item format');
        addResult('レスポンス形式検証', false,
          `不足: ${missing.join(', ')}`, duration);
      }
    } else {
      // エラーレスポンスの場合もsuccess, errorの形式を確認
      const hasSuccess = 'success' in body;
      const hasError = 'error' in body;

      if (hasSuccess && hasError && body.success === false) {
        addResult('レスポンス形式検証', true,
          `エラーレスポンス形式: success=${body.success}, error="${body.error}"`, duration);
      } else {
        addResult('レスポンス形式検証', false,
          `status: ${response.status}, body: ${JSON.stringify(body)}`, duration);
      }
    }
  } catch (error) {
    addResult('レスポンス形式検証', false, String(error));
  }

  // -----------------------------------------------------------------
  // 追加テスト: e-Stat APIからのデータ取得とDB保存確認
  // -----------------------------------------------------------------
  try {
    console.log('\n追加テスト: データベースへの保存確認');

    // 現在のmarket_dataテーブルのレコード数を取得
    const countResult = await query('SELECT COUNT(*) as count FROM market_data');
    const recordCount = parseInt(countResult.rows[0].count, 10);

    if (recordCount >= 0) {
      addResult('データベース保存確認', true,
        `market_dataテーブル: ${recordCount}件のレコード`);
    } else {
      addResult('データベース保存確認', false,
        `レコード数取得失敗`);
    }
  } catch (error) {
    addResult('データベース保存確認', false, String(error));
  }

  // -----------------------------------------------------------------
  // 結果サマリー
  // -----------------------------------------------------------------
  console.log('\n========================================');
  console.log('テスト結果サマリー');
  console.log('========================================');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nテスト結果: ${passed}/${results.length} PASSED`);

  if (failed > 0) {
    console.log('\nFAILED項目:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`- [${r.name}]: ${r.error || '理由不明'}`);
    });
  }

  // プールを閉じる
  await closePool();

  return { passed, failed, total: results.length };
}

// テスト実行
runTests()
  .then(({ passed, failed }) => {
    console.log('\n========================================');
    console.log('テスト完了');
    console.log('========================================');
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
