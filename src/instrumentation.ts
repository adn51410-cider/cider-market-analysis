import { closePool } from '@/lib/db';

/**
 * グレースフルシャットダウンのタイムアウト（ミリ秒）
 * Cloud Runの10秒制限に対応するため8秒に設定
 */
const SHUTDOWN_TIMEOUT_MS = 8000;

/**
 * シャットダウン中かどうかのフラグ
 */
let isShuttingDown = false;

/**
 * グレースフルシャットダウン処理
 * 進行中のリクエスト完了を待ち、データベース接続プールを安全に終了
 */
async function gracefulShutdown(signal: string): Promise<void> {
  // 二重実行を防止
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`[Shutdown] Received ${signal} signal, starting graceful shutdown...`);

  // タイムアウト付きでシャットダウン処理を実行
  const shutdownPromise = (async () => {
    try {
      // データベース接続プールを終了
      await closePool();
      console.log('[Shutdown] Database pool closed successfully');
    } catch (error) {
      console.error('[Shutdown] Error closing database pool:', error);
    }
  })();

  // タイムアウトPromise
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn(`[Shutdown] Timeout reached (${SHUTDOWN_TIMEOUT_MS}ms), forcing shutdown...`);
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
  });

  // シャットダウン処理とタイムアウトのいずれか早い方で完了
  await Promise.race([shutdownPromise, timeoutPromise]);

  console.log('[Shutdown] Graceful shutdown completed');
  process.exit(0);
}

/**
 * Next.js instrumentation register関数
 * サーバー起動時にシグナルハンドラーを設定
 */
export async function register(): Promise<void> {
  // サーバーサイドでのみシグナルハンドラーを設定
  if (typeof process !== 'undefined' && process.on) {
    // 既存のリスナーを削除して重複を防止
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');

    // SIGTERMシグナルハンドラー（Cloud Run/Kubernetes用）
    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM');
    });

    // SIGINTシグナルハンドラー（開発時Ctrl+C用）
    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT');
    });

    console.log('[Instrumentation] Graceful shutdown handlers registered');
  }
}
