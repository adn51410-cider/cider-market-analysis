import { NextResponse } from 'next/server';
import { checkConnection } from '@/lib/db';

/**
 * ヘルスチェックレスポンスの型定義
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  timestamp: string;
  responseTime: number;
}

/**
 * ヘルスチェックエンドポイント
 * データベース接続状態を確認し、5秒以内に応答を保証
 *
 * @returns {Promise<NextResponse>} ヘルスチェック結果
 *
 * レスポンス例:
 * {
 *   "status": "healthy",
 *   "database": "connected",
 *   "timestamp": "2026-01-11T12:00:00.000Z",
 *   "responseTime": 123
 * }
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const startTime = Date.now();

  // DB接続チェック（5秒タイムアウト）
  const DB_CHECK_TIMEOUT_MS = 5000;
  const isDbConnected = await checkConnection(DB_CHECK_TIMEOUT_MS);

  const responseTime = Date.now() - startTime;
  const timestamp = new Date().toISOString();

  const response: HealthCheckResponse = {
    status: isDbConnected ? 'healthy' : 'unhealthy',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp,
    responseTime,
  };

  // ステータスに応じてHTTPステータスコードを設定
  const httpStatus = isDbConnected ? 200 : 503;

  return NextResponse.json(response, { status: httpStatus });
}
