import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

/**
 * データベース接続プールを取得
 * シングルトンパターンで接続プールを管理
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: false }, // Neon requires SSL
      max: 10, // 最大接続数
      idleTimeoutMillis: 30000, // アイドルタイムアウト
      connectionTimeoutMillis: 10000, // 接続タイムアウト（10秒）
    });

    // 接続エラーのハンドリング
    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Unexpected error on idle database client', err);
    });
  }
  return pool;
}

/**
 * データベースクエリを実行（プリペアドステートメント使用）
 * @param text SQLクエリ文字列
 * @param params パラメータ配列
 * @returns クエリ結果
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null | Date | unknown)[]
): Promise<QueryResult<T>> {
  const dbPool = getPool();
  const start = Date.now();

  try {
    const result = await dbPool.query<T>(text, params);
    const duration = Date.now() - start;

    // 開発環境でのデバッグログ（本番では無効）
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      // eslint-disable-next-line no-console
      console.warn('Slow query detected:', { text, duration: `${duration}ms` });
    }

    return result;
  } catch (error) {
    // エラー情報を安全にログ出力
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    // eslint-disable-next-line no-console
    console.error('Database query error:', {
      query: text.substring(0, 100), // クエリの最初の100文字のみ
      error: errorMessage
    });
    throw error;
  }
}

/**
 * トランザクション内でコールバック関数を実行
 * @param callback トランザクション内で実行する関数
 * @returns コールバックの戻り値
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const dbPool = getPool();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * トランザクション用のクエリ関数
 * PoolClient内でプリペアドステートメントを使用してクエリを実行
 */
export async function queryWithClient<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  params?: (string | number | boolean | null | Date | unknown)[]
): Promise<QueryResult<T>> {
  try {
    return await client.query<T>(text, params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    // eslint-disable-next-line no-console
    console.error('Database query error (in transaction):', {
      query: text.substring(0, 100),
      error: errorMessage
    });
    throw error;
  }
}

/**
 * データベース接続の健全性チェック
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns 接続成功ならtrue
 */
export async function checkConnection(timeoutMs: number = 5000): Promise<boolean> {
  const dbPool = getPool();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, timeoutMs);

    dbPool.query('SELECT 1')
      .then(() => {
        clearTimeout(timeout);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
  });
}

/**
 * 接続プールを終了（グレースフルシャットダウン用）
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * データベース統計情報を取得
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} | null {
  if (!pool) {
    return null;
  }
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
