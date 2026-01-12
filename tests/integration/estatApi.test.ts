/**
 * スライス2-B: e-Stat API連携 統合テスト
 *
 * 検証対象:
 * - e-Stat APIクライアント（タイムアウト10秒、リトライ3回）
 * - パラメータハッシュ生成（キャッシュキー）
 * - キャッシュ機構（5分有効期限）
 * - e-StatレスポンスJSON → MarketData形式変換
 * - エラーハンドリング（リトライ、指数バックオフ）
 *
 * 注意: このテストは実際のe-Stat APIとデータベースに接続します
 */

require('dotenv').config({ path: '.env.local' });

import {
  generateCacheKey,
  parseTimeCode,
  transformEstatResponse,
  fetchEstatData,
  cleanupExpiredCache,
  EstatApiError,
  EstatApiErrorType,
  EstatApiParams,
  EstatApiResponse,
  CATEGORY_MAPPING,
} from '../../src/lib/estatApi';
import { query, closePool } from '../../src/lib/db';

// ============================================================
// テストユーティリティ
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

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

// ============================================================
// テストケース
// ============================================================

async function runTests() {
  console.log('========================================');
  console.log('スライス2-B: e-Stat API連携 統合テスト');
  console.log('========================================\n');

  // 環境変数チェック
  if (!process.env.ESTAT_API_KEY) {
    console.error('ERROR: ESTAT_API_KEY is not set in .env.local');
    process.exit(1);
  }

  // -----------------------------------------------------------------
  // テスト1: パラメータハッシュ生成（キャッシュキー）
  // -----------------------------------------------------------------
  try {
    console.log('テスト1: パラメータハッシュ生成');

    const params1: EstatApiParams = {
      statsDataId: '0002070001',
      cdTimeFrom: '2020000101',
      cdTimeTo: '2020001231',
    };

    const params2: EstatApiParams = {
      statsDataId: '0002070001',
      cdTimeTo: '2020001231',   // 順序を変更
      cdTimeFrom: '2020000101',
    };

    const params3: EstatApiParams = {
      statsDataId: '0002070002', // 異なるID
      cdTimeFrom: '2020000101',
      cdTimeTo: '2020001231',
    };

    const endpoint = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';

    const hash1 = generateCacheKey(endpoint, params1);
    const hash2 = generateCacheKey(endpoint, params2);
    const hash3 = generateCacheKey(endpoint, params3);

    // 同じパラメータ（順序違い）は同じハッシュ
    // 異なるパラメータは異なるハッシュ
    const sameParamsHash = hash1 === hash2;
    const diffParamsHash = hash1 !== hash3;

    if (sameParamsHash && diffParamsHash && hash1.length === 64) {
      addResult('パラメータハッシュ生成（SHA256）', true);
    } else {
      addResult('パラメータハッシュ生成（SHA256）', false,
        `hash1=${hash1.substring(0, 16)}..., hash2=${hash2.substring(0, 16)}..., hash3=${hash3.substring(0, 16)}...`);
    }
  } catch (error) {
    addResult('パラメータハッシュ生成（SHA256）', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト2: 時間軸コード変換
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト2: 時間軸コード変換');

    const testCases = [
      { input: '2020000101', expected: '2020-01' },
      { input: '2020000601', expected: '2020-06' },
      { input: '2020001201', expected: '2020-12' },
      { input: '2020', expected: '2020-01' },
    ];

    let allPassed = true;
    for (const tc of testCases) {
      const result = parseTimeCode(tc.input);
      if (result !== tc.expected) {
        allPassed = false;
        addResult(`時間軸コード変換: ${tc.input}`, false,
          `期待: ${tc.expected}, 実際: ${result}`);
      }
    }

    if (allPassed) {
      addResult('時間軸コード変換', true);
    }
  } catch (error) {
    addResult('時間軸コード変換', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト3: カテゴリーマッピング定義
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト3: カテゴリーマッピング定義');

    const expectedCategories = ['ワイン', '日本酒', 'ビール', '焼酎', 'ウイスキー', 'シードル'];
    const definedCategories = Object.values(CATEGORY_MAPPING);

    const hasWine = definedCategories.includes('ワイン');
    const hasSake = definedCategories.includes('日本酒');
    const hasCider = definedCategories.includes('シードル');

    if (hasWine && hasSake && hasCider) {
      addResult('カテゴリーマッピング定義', true);
    } else {
      addResult('カテゴリーマッピング定義', false,
        `マッピング: ${definedCategories.join(', ')}`);
    }
  } catch (error) {
    addResult('カテゴリーマッピング定義', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト4: レスポンスデータ変換（モック）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト4: レスポンスデータ変換（モック）');

    const mockResponse: EstatApiResponse = {
      GET_STATS_DATA: {
        RESULT: {
          STATUS: 0,
          DATE: '2026-01-11T00:00:00',
        },
        PARAMETER: {},
        STATISTICAL_DATA: {
          RESULT_INF: {
            TOTAL_NUMBER: 2,
          },
          CLASS_INF: {
            CLASS_OBJ: [
              {
                '@id': 'cat01',
                '@name': '品目',
                CLASS: [
                  { '@code': '5311', '@name': 'ワイン' },
                  { '@code': '5320', '@name': '清酒' },
                ],
              },
              {
                '@id': 'time',
                '@name': '時間軸',
                CLASS: { '@code': '2020000101', '@name': '2020年1月' },
              },
            ],
          },
          DATA_INF: {
            VALUE: [
              { '@cat01': '5311', '@time': '2020000101', '$': '1234' },
              { '@cat01': '5311', '@time': '2020000201', '$': '2345' },
              { '@cat01': '5320', '@time': '2020000101', '$': '3456' },
              { '@cat01': '5320', '@time': '2020000201', '$': '-' }, // 無効値
            ],
          },
        },
      },
    };

    const marketData = transformEstatResponse(mockResponse);

    // 検証: 無効値（-）を除いた3件
    const hasThreeItems = marketData.length === 3;
    const hasWineJan = marketData.some(
      d => d.category === 'ワイン' && d.yearMonth === '2020-01' && d.value === 1234
    );
    const hasSakeJan = marketData.some(
      d => d.category === '日本酒' && d.yearMonth === '2020-01' && d.value === 3456
    );
    const allEstat = marketData.every(d => d.source === 'estat');

    if (hasThreeItems && hasWineJan && hasSakeJan && allEstat) {
      addResult('レスポンスデータ変換（モック）', true);
    } else {
      addResult('レスポンスデータ変換（モック）', false,
        `件数: ${marketData.length}, ワイン1月: ${hasWineJan}, 日本酒1月: ${hasSakeJan}`);
    }
  } catch (error) {
    addResult('レスポンスデータ変換（モック）', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト5: e-Stat API呼び出し（実際のAPI）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト5: e-Stat API呼び出し（実際のAPI）');

    const { result: response, duration } = await measureTime(async () => {
      return await fetchEstatData({
        statsDataId: '0002070001',
        limit: 10,
        metaGetFlg: 'Y',
      });
    });

    // レスポンスの基本検証
    const hasResult = response.GET_STATS_DATA !== undefined;
    const statusOk = response.GET_STATS_DATA.RESULT.STATUS === 0;
    const hasData = response.GET_STATS_DATA.STATISTICAL_DATA !== undefined;

    if (hasResult && statusOk && hasData) {
      addResult('e-Stat API呼び出し（実際のAPI）', true, undefined, duration);
    } else {
      addResult('e-Stat API呼び出し（実際のAPI）', false,
        `STATUS: ${response.GET_STATS_DATA.RESULT.STATUS}, ERROR: ${response.GET_STATS_DATA.RESULT.ERROR_MSG}`,
        duration);
    }
  } catch (error) {
    if (error instanceof EstatApiError) {
      addResult('e-Stat API呼び出し（実際のAPI）', false,
        `${error.type}: ${error.message}`);
    } else {
      addResult('e-Stat API呼び出し（実際のAPI）', false, String(error));
    }
  }

  // -----------------------------------------------------------------
  // テスト6: タイムアウト設定（10秒以内応答）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト6: タイムアウト設定（10秒以内応答）');

    const { result: _, duration } = await measureTime(async () => {
      return await fetchEstatData({
        statsDataId: '0002070001',
        limit: 10,
      });
    });

    if (duration < 10000) {
      addResult('タイムアウト設定（10秒以内応答）', true, undefined, duration);
    } else {
      addResult('タイムアウト設定（10秒以内応答）', false,
        `応答時間: ${duration}ms > 10000ms`, duration);
    }
  } catch (error) {
    if (error instanceof EstatApiError && error.type === EstatApiErrorType.TIMEOUT) {
      addResult('タイムアウト設定（10秒以内応答）', false,
        'タイムアウトエラーが発生しました');
    } else {
      addResult('タイムアウト設定（10秒以内応答）', false, String(error));
    }
  }

  // -----------------------------------------------------------------
  // テスト7: キャッシュ保存・取得
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト7: キャッシュ保存・取得');

    // ユニークなパラメータでキャッシュを新規作成
    const uniqueLimit = Math.floor(Math.random() * 10) + 1;
    const testParams = {
      statsDataId: '0002070001',
      limit: uniqueLimit,
      startPosition: Date.now() % 1000, // ユニークにするため
    };

    const endpoint = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';
    const cacheKey = generateCacheKey(endpoint, testParams);

    // 既存のキャッシュを削除
    await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);

    // 最初の呼び出し（キャッシュなし - APIから取得）
    const { duration: duration1 } = await measureTime(async () => {
      return await fetchEstatData(testParams);
    });

    // 2回目の呼び出し（キャッシュあり - DBから取得）
    const { duration: duration2 } = await measureTime(async () => {
      return await fetchEstatData(testParams);
    });

    // キャッシュヒット時は大幅に高速化されるはず
    const speedup = duration1 / (duration2 || 1);

    if (duration2 < duration1 && speedup > 2) {
      addResult('キャッシュ保存・取得', true,
        `1回目: ${duration1}ms, 2回目: ${duration2}ms (${speedup.toFixed(1)}倍高速)`,
        duration2);
    } else if (duration1 > 1000 && duration2 < 500) {
      // API呼び出しが1秒以上、キャッシュが500ms以下なら成功
      addResult('キャッシュ保存・取得', true,
        `1回目(API): ${duration1}ms, 2回目(Cache): ${duration2}ms`, duration2);
    } else {
      addResult('キャッシュ保存・取得', false,
        `1回目: ${duration1}ms, 2回目: ${duration2}ms（speedup: ${speedup.toFixed(1)}x）`);
    }

    // クリーンアップ
    await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);
  } catch (error) {
    addResult('キャッシュ保存・取得', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト8: キャッシュのデータベース保存確認
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト8: キャッシュのデータベース保存確認');

    const endpoint = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';
    const testParams: EstatApiParams = {
      statsDataId: '0002070001',
      limit: 3,
      startPosition: Date.now() % 100, // ユニークなパラメータ
    };
    const cacheKey = generateCacheKey(endpoint, testParams);

    // まず既存のキャッシュを削除して新規作成
    await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);

    // APIを呼び出してキャッシュを新規作成
    await fetchEstatData(testParams);

    const result = await query(`
      SELECT cache_key, endpoint, expires_at
      FROM api_cache
      WHERE cache_key = $1
    `, [cacheKey]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const expiresAt = new Date(row.expires_at);
      const now = new Date();

      // 有効期限が現在時刻より後であること
      if (expiresAt > now) {
        addResult('キャッシュのデータベース保存確認', true,
          `有効期限: ${expiresAt.toISOString()}`);
      } else {
        addResult('キャッシュのデータベース保存確認', false,
          `キャッシュが期限切れ: ${expiresAt.toISOString()}`);
      }
    } else {
      addResult('キャッシュのデータベース保存確認', false,
        'キャッシュエントリが見つかりません');
    }

    // クリーンアップ
    await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);
  } catch (error) {
    addResult('キャッシュのデータベース保存確認', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト9: キャッシュ有効期限（5分）
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト9: キャッシュ有効期限（5分）');

    // 新しいユニークなパラメータでキャッシュを作成
    const testTimestamp = Date.now();
    const uniqueParams: EstatApiParams = {
      statsDataId: '0002070001',
      limit: 2,
      startPosition: (testTimestamp % 500) + 500, // ユニークにするため
    };

    const endpoint = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';
    const cacheKey = generateCacheKey(endpoint, uniqueParams);

    // 既存のキャッシュを確実に削除
    await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);

    // APIを呼び出してキャッシュを作成（作成時刻を記録）
    const beforeApiCall = Date.now();
    await fetchEstatData(uniqueParams);
    const afterApiCall = Date.now();

    const result = await query(`
      SELECT cache_key, created_at, expires_at
      FROM api_cache
      WHERE cache_key = $1
    `, [cacheKey]);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const expiresAt = new Date(row.expires_at);

      // 作成時刻はAPI呼び出し時刻を基準に計算
      // expires_at - 5分 = 作成時刻 であるべき
      const expectedCreatedTime = expiresAt.getTime() - (5 * 60 * 1000);

      // API呼び出し時刻の範囲内であること
      const isCreatedTimeValid =
        expectedCreatedTime >= beforeApiCall - 1000 &&
        expectedCreatedTime <= afterApiCall + 1000;

      // expires_atが現在から約5分後であること
      const now = Date.now();
      const ttlFromNow = (expiresAt.getTime() - now) / 1000 / 60;

      if (isCreatedTimeValid && ttlFromNow > 4 && ttlFromNow < 6) {
        addResult('キャッシュ有効期限（5分）', true,
          `残り有効期限: ${ttlFromNow.toFixed(2)}分`);
      } else {
        addResult('キャッシュ有効期限（5分）', false,
          `残りTTL: ${ttlFromNow.toFixed(2)}分, 作成時刻検証: ${isCreatedTimeValid}`);
      }

      // クリーンアップ
      await query('DELETE FROM api_cache WHERE cache_key = $1', [cacheKey]);
    } else {
      addResult('キャッシュ有効期限（5分）', false,
        'キャッシュエントリが見つかりません');
    }
  } catch (error) {
    addResult('キャッシュ有効期限（5分）', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト10: 期限切れキャッシュクリーンアップ
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト10: 期限切れキャッシュクリーンアップ');

    // 期限切れのテストキャッシュを挿入
    const testCacheKey = `test_expired_${Date.now()}`;

    // PostgreSQLのNOW()と比較するため、ISO形式で1時間前の時刻を指定
    await query(`
      INSERT INTO api_cache (cache_key, endpoint, params, response, expires_at)
      VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 hour')
    `, [
      testCacheKey,
      'https://test.example.com',
      JSON.stringify({}),
      JSON.stringify({}),
    ]);

    // 挿入確認
    const beforeCleanup = await query(`
      SELECT cache_key, expires_at FROM api_cache WHERE cache_key = $1
    `, [testCacheKey]);

    if (beforeCleanup.rows.length === 0) {
      addResult('期限切れキャッシュクリーンアップ', false,
        'テストデータの挿入に失敗');
    } else {
      // クリーンアップ実行
      const deletedCount = await cleanupExpiredCache();

      // テストキャッシュが削除されたことを確認
      const result = await query(`
        SELECT cache_key FROM api_cache WHERE cache_key = $1
      `, [testCacheKey]);

      if (result.rows.length === 0 && deletedCount >= 1) {
        addResult('期限切れキャッシュクリーンアップ', true,
          `${deletedCount}件削除`);
      } else {
        // 手動でクリーンアップ
        await query('DELETE FROM api_cache WHERE cache_key = $1', [testCacheKey]);
        addResult('期限切れキャッシュクリーンアップ', false,
          `削除件数: ${deletedCount}, 残存: ${result.rows.length}件`);
      }
    }
  } catch (error) {
    addResult('期限切れキャッシュクリーンアップ', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト11: 無効なAPIキーでのエラーハンドリング
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト11: エラーハンドリング（バリデーション）');

    // 環境変数を一時的に退避
    const originalApiKey = process.env.ESTAT_API_KEY;
    delete process.env.ESTAT_API_KEY;

    try {
      await fetchEstatData({
        statsDataId: '0002070001',
        limit: 5,
      });

      addResult('エラーハンドリング（バリデーション）', false,
        'エラーが発生しませんでした');
    } catch (error) {
      if (error instanceof EstatApiError && error.type === EstatApiErrorType.VALIDATION) {
        addResult('エラーハンドリング（バリデーション）', true,
          'VALIDATION エラーを正しく検出');
      } else {
        addResult('エラーハンドリング（バリデーション）', false,
          `予期しないエラー: ${error}`);
      }
    } finally {
      // 環境変数を復元
      process.env.ESTAT_API_KEY = originalApiKey;
    }
  } catch (error) {
    addResult('エラーハンドリング（バリデーション）', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト12: EstatApiErrorクラスの構造
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト12: EstatApiErrorクラスの構造');

    const testError = new EstatApiError(
      'Test error message',
      EstatApiErrorType.NETWORK,
      500,
      new Error('Original error')
    );

    const hasMessage = testError.message === 'Test error message';
    const hasType = testError.type === EstatApiErrorType.NETWORK;
    const hasStatusCode = testError.statusCode === 500;
    const hasOriginalError = testError.originalError?.message === 'Original error';
    const hasName = testError.name === 'EstatApiError';

    if (hasMessage && hasType && hasStatusCode && hasOriginalError && hasName) {
      addResult('EstatApiErrorクラスの構造', true);
    } else {
      addResult('EstatApiErrorクラスの構造', false,
        `message: ${hasMessage}, type: ${hasType}, statusCode: ${hasStatusCode}`);
    }
  } catch (error) {
    addResult('EstatApiErrorクラスの構造', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト13: 空のレスポンス変換
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト13: 空のレスポンス変換');

    const emptyResponse: EstatApiResponse = {
      GET_STATS_DATA: {
        RESULT: {
          STATUS: 0,
          DATE: '2026-01-11T00:00:00',
        },
        PARAMETER: {},
        STATISTICAL_DATA: {
          RESULT_INF: {
            TOTAL_NUMBER: 0,
          },
        },
      },
    };

    const marketData = transformEstatResponse(emptyResponse);

    if (marketData.length === 0) {
      addResult('空のレスポンス変換', true);
    } else {
      addResult('空のレスポンス変換', false,
        `期待: 0件, 実際: ${marketData.length}件`);
    }
  } catch (error) {
    addResult('空のレスポンス変換', false, String(error));
  }

  // -----------------------------------------------------------------
  // テスト14: 無効値のフィルタリング
  // -----------------------------------------------------------------
  try {
    console.log('\nテスト14: 無効値のフィルタリング');

    const responseWithInvalidValues: EstatApiResponse = {
      GET_STATS_DATA: {
        RESULT: {
          STATUS: 0,
          DATE: '2026-01-11T00:00:00',
        },
        PARAMETER: {},
        STATISTICAL_DATA: {
          RESULT_INF: {
            TOTAL_NUMBER: 5,
          },
          DATA_INF: {
            VALUE: [
              { '@cat01': '5311', '@time': '2020000101', '$': '1234' },    // 有効
              { '@cat01': '5311', '@time': '2020000201', '$': '-' },       // 無効: ハイフン
              { '@cat01': '5311', '@time': '2020000301', '$': '***' },     // 無効: アスタリスク
              { '@cat01': '5311', '@time': '2020000401', '$': '...' },     // 無効: 省略記号
              { '@cat01': '5311', '@time': '2020000501', '$': '5,678' },   // 有効: カンマ区切り
            ],
          },
        },
      },
    };

    const marketData = transformEstatResponse(responseWithInvalidValues);

    // 有効な値のみ2件
    const hasValidCount = marketData.length === 2;
    const hasCommaValue = marketData.some(d => d.value === 5678);

    if (hasValidCount && hasCommaValue) {
      addResult('無効値のフィルタリング', true,
        `有効データ: ${marketData.length}件`);
    } else {
      addResult('無効値のフィルタリング', false,
        `件数: ${marketData.length}, カンマ区切り解析: ${hasCommaValue}`);
    }
  } catch (error) {
    addResult('無効値のフィルタリング', false, String(error));
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
