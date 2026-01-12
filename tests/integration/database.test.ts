/**
 * スライス1: データベース基盤 統合テスト
 *
 * 検証対象:
 * - market_dataテーブル（8カラム、ユニーク制約、インデックス3個）
 * - api_cacheテーブル（7カラム、ユニーク制約、インデックス2個）
 * - データベースユーティリティ関数（src/lib/db.ts）
 */

require('dotenv').config({ path: '.env.local' });

import { query, transaction, checkConnection, closePool, queryWithClient } from '../../src/lib/db';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const status = passed ? 'PASSED' : 'FAILED';
  console.log(`[${status}] ${name}${error ? ': ' + error : ''}`);
}

async function runTests() {
  console.log('========================================');
  console.log('スライス1: データベース基盤 統合テスト');
  console.log('========================================\n');

  // テスト1: 接続チェック（5秒以内応答）
  try {
    console.log('テスト1: 接続チェック（5秒以内応答）');
    const startTime = Date.now();
    const connected = await checkConnection(5000);
    const elapsed = Date.now() - startTime;

    if (connected && elapsed < 5000) {
      addResult('接続チェック（5秒以内応答）', true);
    } else {
      addResult('接続チェック（5秒以内応答）', false,
        connected ? `応答時間: ${elapsed}ms > 5000ms` : '接続失敗');
    }
  } catch (error) {
    addResult('接続チェック（5秒以内応答）', false, String(error));
  }

  // テスト2: market_dataテーブルの存在確認
  try {
    console.log('\nテスト2: market_dataテーブルの存在確認');
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'market_data'
      ) as exists
    `);
    const exists = result.rows[0]?.exists === true;
    addResult('market_dataテーブルの存在確認', exists,
      exists ? undefined : 'テーブルが存在しません');
  } catch (error) {
    addResult('market_dataテーブルの存在確認', false, String(error));
  }

  // テスト3: api_cacheテーブルの存在確認
  try {
    console.log('\nテスト3: api_cacheテーブルの存在確認');
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'api_cache'
      ) as exists
    `);
    const exists = result.rows[0]?.exists === true;
    addResult('api_cacheテーブルの存在確認', exists,
      exists ? undefined : 'テーブルが存在しません');
  } catch (error) {
    addResult('api_cacheテーブルの存在確認', false, String(error));
  }

  // テスト4: market_dataテーブルのカラム確認（8カラム）
  try {
    console.log('\nテスト4: market_dataテーブルのカラム確認');
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'market_data'
      ORDER BY ordinal_position
    `);

    const expectedColumns = ['id', 'category', 'year_month', 'value', 'data_type', 'source', 'created_at', 'updated_at'];
    const actualColumns = (result.rows as Array<{ column_name: string }>).map((r) => r.column_name);

    const hasAllColumns = expectedColumns.every(col => actualColumns.includes(col));
    const columnCount = actualColumns.length;

    if (hasAllColumns && columnCount === 8) {
      addResult('market_dataカラム確認（8カラム）', true);
    } else {
      addResult('market_dataカラム確認（8カラム）', false,
        `期待: ${expectedColumns.join(', ')}\n実際: ${actualColumns.join(', ')}`);
    }
  } catch (error) {
    addResult('market_dataカラム確認（8カラム）', false, String(error));
  }

  // テスト5: api_cacheテーブルのカラム確認（7カラム）
  try {
    console.log('\nテスト5: api_cacheテーブルのカラム確認');
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'api_cache'
      ORDER BY ordinal_position
    `);

    const expectedColumns = ['id', 'cache_key', 'endpoint', 'params', 'response', 'expires_at', 'created_at'];
    const actualColumns = (result.rows as Array<{ column_name: string }>).map((r) => r.column_name);

    const hasAllColumns = expectedColumns.every(col => actualColumns.includes(col));
    const columnCount = actualColumns.length;

    // api_cacheは6カラムまたは7カラムの可能性（updated_atがないため）
    if (hasAllColumns && (columnCount === 6 || columnCount === 7)) {
      addResult('api_cacheカラム確認（6-7カラム）', true);
    } else {
      addResult('api_cacheカラム確認（6-7カラム）', false,
        `期待: ${expectedColumns.join(', ')}\n実際: ${actualColumns.join(', ')}`);
    }
  } catch (error) {
    addResult('api_cacheカラム確認（6-7カラム）', false, String(error));
  }

  // テスト6: market_dataのインデックス確認（3個）
  try {
    console.log('\nテスト6: market_dataのインデックス確認');
    const result = await query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'market_data'
    `);

    const indexNames = (result.rows as Array<{ indexname: string }>).map((r) => r.indexname);
    const expectedIndexes = ['idx_market_data_category', 'idx_market_data_year_month', 'idx_market_data_lookup'];

    const foundIndexes = expectedIndexes.filter(idx => indexNames.includes(idx));

    if (foundIndexes.length >= 3) {
      addResult('market_dataインデックス確認（3個）', true);
    } else {
      addResult('market_dataインデックス確認（3個）', false,
        `期待: ${expectedIndexes.join(', ')}\n検出: ${indexNames.join(', ')}`);
    }
  } catch (error) {
    addResult('market_dataインデックス確認（3個）', false, String(error));
  }

  // テスト7: api_cacheのインデックス確認（2個）
  try {
    console.log('\nテスト7: api_cacheのインデックス確認');
    const result = await query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'api_cache'
    `);

    const indexNames = (result.rows as Array<{ indexname: string }>).map((r) => r.indexname);
    const expectedIndexes = ['idx_api_cache_key', 'idx_api_cache_expires'];

    const foundIndexes = expectedIndexes.filter(idx => indexNames.includes(idx));

    if (foundIndexes.length >= 2) {
      addResult('api_cacheインデックス確認（2個）', true);
    } else {
      addResult('api_cacheインデックス確認（2個）', false,
        `期待: ${expectedIndexes.join(', ')}\n検出: ${indexNames.join(', ')}`);
    }
  } catch (error) {
    addResult('api_cacheインデックス確認（2個）', false, String(error));
  }

  // テスト8: market_dataユニーク制約確認
  try {
    console.log('\nテスト8: market_dataユニーク制約確認');
    const result = await query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'market_data'::regclass AND contype = 'u'
    `);

    if (result.rows.length >= 1) {
      addResult('market_dataユニーク制約確認', true);
    } else {
      addResult('market_dataユニーク制約確認', false, 'ユニーク制約が見つかりません');
    }
  } catch (error) {
    addResult('market_dataユニーク制約確認', false, String(error));
  }

  // テスト9: api_cacheユニーク制約確認
  try {
    console.log('\nテスト9: api_cacheユニーク制約確認');
    const result = await query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'api_cache'::regclass AND contype = 'u'
    `);

    if (result.rows.length >= 1) {
      addResult('api_cacheユニーク制約確認', true);
    } else {
      addResult('api_cacheユニーク制約確認', false, 'ユニーク制約が見つかりません');
    }
  } catch (error) {
    addResult('api_cacheユニーク制約確認', false, String(error));
  }

  // テスト10: CRUD操作 - INSERT/SELECT
  const testId = `test_${Date.now()}`;
  try {
    console.log('\nテスト10: CRUD操作 - INSERT/SELECT');

    // INSERT
    await query(`
      INSERT INTO market_data (category, year_month, value, data_type, source)
      VALUES ($1, $2, $3, $4, $5)
    `, [testId, '2026-01', 99999.99, 'sales', 'manual']);

    // SELECT
    const selectResult = await query(`
      SELECT * FROM market_data WHERE category = $1
    `, [testId]);

    if (selectResult.rows.length === 1 &&
        selectResult.rows[0].category === testId &&
        parseFloat(selectResult.rows[0].value) === 99999.99) {
      addResult('CRUD操作 - INSERT/SELECT', true);
    } else {
      addResult('CRUD操作 - INSERT/SELECT', false, 'データが正しく挿入されませんでした');
    }
  } catch (error) {
    addResult('CRUD操作 - INSERT/SELECT', false, String(error));
  }

  // テスト11: CRUD操作 - UPDATE
  try {
    console.log('\nテスト11: CRUD操作 - UPDATE');

    await query(`
      UPDATE market_data SET value = $1 WHERE category = $2
    `, [88888.88, testId]);

    const selectResult = await query(`
      SELECT value FROM market_data WHERE category = $1
    `, [testId]);

    if (selectResult.rows.length === 1 &&
        parseFloat(selectResult.rows[0].value) === 88888.88) {
      addResult('CRUD操作 - UPDATE', true);
    } else {
      addResult('CRUD操作 - UPDATE', false, 'データが正しく更新されませんでした');
    }
  } catch (error) {
    addResult('CRUD操作 - UPDATE', false, String(error));
  }

  // テスト12: CRUD操作 - DELETE
  try {
    console.log('\nテスト12: CRUD操作 - DELETE');

    await query(`
      DELETE FROM market_data WHERE category = $1
    `, [testId]);

    const selectResult = await query(`
      SELECT * FROM market_data WHERE category = $1
    `, [testId]);

    if (selectResult.rows.length === 0) {
      addResult('CRUD操作 - DELETE', true);
    } else {
      addResult('CRUD操作 - DELETE', false, 'データが削除されませんでした');
    }
  } catch (error) {
    addResult('CRUD操作 - DELETE', false, String(error));
  }

  // テスト13: トランザクション - COMMIT
  try {
    console.log('\nテスト13: トランザクション - COMMIT');

    const txTestId = `tx_commit_${Date.now()}`;

    await transaction(async (client) => {
      await queryWithClient(client, `
        INSERT INTO market_data (category, year_month, value, data_type, source)
        VALUES ($1, $2, $3, $4, $5)
      `, [txTestId, '2026-02', 11111.11, 'volume', 'manual']);
      return true;
    });

    // トランザクション後にデータが残っていることを確認
    const result = await query(`
      SELECT * FROM market_data WHERE category = $1
    `, [txTestId]);

    if (result.rows.length === 1) {
      addResult('トランザクション - COMMIT', true);
      // クリーンアップ
      await query('DELETE FROM market_data WHERE category = $1', [txTestId]);
    } else {
      addResult('トランザクション - COMMIT', false, 'COMMITされたデータが見つかりません');
    }
  } catch (error) {
    addResult('トランザクション - COMMIT', false, String(error));
  }

  // テスト14: トランザクション - ROLLBACK
  try {
    console.log('\nテスト14: トランザクション - ROLLBACK');

    const txTestId = `tx_rollback_${Date.now()}`;

    try {
      await transaction(async (client) => {
        await queryWithClient(client, `
          INSERT INTO market_data (category, year_month, value, data_type, source)
          VALUES ($1, $2, $3, $4, $5)
        `, [txTestId, '2026-03', 22222.22, 'price', 'manual']);

        // 意図的にエラーを発生させてROLLBACKを強制
        throw new Error('Intentional error for ROLLBACK test');
      });
    } catch {
      // エラーは期待通り
    }

    // ROLLBACKされたのでデータは存在しないはず
    const result = await query(`
      SELECT * FROM market_data WHERE category = $1
    `, [txTestId]);

    if (result.rows.length === 0) {
      addResult('トランザクション - ROLLBACK', true);
    } else {
      addResult('トランザクション - ROLLBACK', false, 'ROLLBACKされたはずのデータが存在します');
    }
  } catch (error) {
    addResult('トランザクション - ROLLBACK', false, String(error));
  }

  // テスト15: ユニーク制約違反時のエラーハンドリング
  try {
    console.log('\nテスト15: ユニーク制約違反時のエラーハンドリング');

    const uniqueTestId = `unique_${Date.now()}`;

    // 最初のINSERT
    await query(`
      INSERT INTO market_data (category, year_month, value, data_type, source)
      VALUES ($1, $2, $3, $4, $5)
    `, [uniqueTestId, '2026-04', 33333.33, 'sales', 'manual']);

    // 同じキーでINSERT（ユニーク制約違反）
    try {
      await query(`
        INSERT INTO market_data (category, year_month, value, data_type, source)
        VALUES ($1, $2, $3, $4, $5)
      `, [uniqueTestId, '2026-04', 44444.44, 'sales', 'manual']);

      addResult('ユニーク制約違反時のエラーハンドリング', false, 'エラーが発生しませんでした');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('23505')) {
        addResult('ユニーク制約違反時のエラーハンドリング', true);
      } else {
        addResult('ユニーク制約違反時のエラーハンドリング', false,
          `予期しないエラー: ${errorMessage}`);
      }
    }

    // クリーンアップ
    await query('DELETE FROM market_data WHERE category = $1', [uniqueTestId]);
  } catch (error) {
    addResult('ユニーク制約違反時のエラーハンドリング', false, String(error));
  }

  // 結果サマリー
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
  .then(({ passed, failed, total }) => {
    console.log('\n========================================');
    console.log('テスト完了');
    console.log('========================================');
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  });
