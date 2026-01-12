/**
 * エラーハンドリングユーティリティ
 * 本番環境ではスタックトレースを非表示にし、開発環境では詳細エラーを表示
 */

import { NextResponse } from 'next/server';

// 環境判定
const isProduction = process.env.NODE_ENV === 'production';

/**
 * エラーコード定義
 * HTTPステータスコードに対応したアプリケーション固有のエラーコード
 */
export const ErrorCodes = {
  // 4xx クライアントエラー
  BAD_REQUEST: 'E400',
  UNAUTHORIZED: 'E401',
  FORBIDDEN: 'E403',
  NOT_FOUND: 'E404',
  METHOD_NOT_ALLOWED: 'E405',
  CONFLICT: 'E409',
  UNPROCESSABLE_ENTITY: 'E422',
  TOO_MANY_REQUESTS: 'E429',

  // 5xx サーバーエラー
  INTERNAL_SERVER_ERROR: 'E500',
  SERVICE_UNAVAILABLE: 'E503',
  DATABASE_ERROR: 'E510',
  EXTERNAL_API_ERROR: 'E520',
  TIMEOUT_ERROR: 'E530',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * 共通エラーレスポンス形式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * 開発環境用の詳細エラーレスポンス
 */
interface DevelopmentErrorResponse extends ErrorResponse {
  error: ErrorResponse['error'] & {
    stack?: string;
    originalError?: string;
  };
}

/**
 * アプリケーションエラークラス
 * 統一されたエラー形式を提供
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Error.captureStackTraceが使用可能な場合のみ呼び出し
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * バリデーションエラークラス
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCodes.BAD_REQUEST, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * 認証エラークラス
 */
export class AuthenticationError extends AppError {
  constructor(message: string = '認証が必要です') {
    super(message, ErrorCodes.UNAUTHORIZED, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * 権限エラークラス
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'アクセス権限がありません') {
    super(message, ErrorCodes.FORBIDDEN, 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * リソース未発見エラークラス
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'リソースが見つかりません') {
    super(message, ErrorCodes.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * データベースエラークラス
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'データベースエラーが発生しました', details?: unknown) {
    super(message, ErrorCodes.DATABASE_ERROR, 500, details);
    this.name = 'DatabaseError';
  }
}

/**
 * 外部APIエラークラス
 */
export class ExternalApiError extends AppError {
  constructor(message: string = '外部サービスとの通信に失敗しました', details?: unknown) {
    super(message, ErrorCodes.EXTERNAL_API_ERROR, 502, details);
    this.name = 'ExternalApiError';
  }
}

/**
 * タイムアウトエラークラス
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'リクエストがタイムアウトしました') {
    super(message, ErrorCodes.TIMEOUT_ERROR, 504);
    this.name = 'TimeoutError';
  }
}

/**
 * エラーをAppErrorに変換
 * 未知のエラーを統一された形式に変換する
 */
function normalizeError(error: unknown): AppError {
  // 既にAppErrorの場合はそのまま返す
  if (error instanceof AppError) {
    return error;
  }

  // 標準のErrorオブジェクトの場合
  if (error instanceof Error) {
    return new AppError(
      isProduction ? 'サーバーエラーが発生しました' : error.message,
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500
    );
  }

  // その他の場合
  return new AppError(
    'サーバーエラーが発生しました',
    ErrorCodes.INTERNAL_SERVER_ERROR,
    500
  );
}

/**
 * エラーログを出力
 * 本番環境では詳細情報をログに記録（レスポンスには含めない）
 */
function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const contextPrefix = context ? `[${context}] ` : '';

  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`${timestamp} ${contextPrefix}Error:`, {
      name: error.name,
      message: error.message,
      // 本番環境でもログにはスタックトレースを記録（デバッグ用）
      stack: error.stack,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(`${timestamp} ${contextPrefix}Unknown error:`, error);
  }
}

/**
 * エラーレスポンスを生成
 * 環境に応じて適切な情報量のレスポンスを返す
 */
export function createErrorResponse(
  error: unknown,
  context?: string
): NextResponse<ErrorResponse | DevelopmentErrorResponse> {
  // エラーをログに記録
  logError(error, context);

  // エラーを正規化
  const appError = normalizeError(error);

  // 基本のエラーレスポンス
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  // 開発環境では詳細情報を追加
  if (!isProduction) {
    const devResponse: DevelopmentErrorResponse = {
      ...errorResponse,
      error: {
        ...errorResponse.error,
        details: appError.details,
        stack: appError.stack,
        originalError: error instanceof Error && !(error instanceof AppError)
          ? error.message
          : undefined,
      },
    };
    return NextResponse.json(devResponse, { status: appError.statusCode });
  }

  // 本番環境ではdetailsも含めない（機密情報漏洩防止）
  return NextResponse.json(errorResponse, { status: appError.statusCode });
}

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<{ success: true; data: T }> {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

/**
 * APIルートハンドラーをラップするユーティリティ
 * 未処理のエラーをキャッチして統一されたエラーレスポンスを返す
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>,
  context?: string
): Promise<NextResponse<T | ErrorResponse | DevelopmentErrorResponse>> {
  return handler().catch((error: unknown) => createErrorResponse(error, context));
}

/**
 * 型ガード: unknownをAppErrorに安全に変換できるか確認
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 安全なエラーメッセージ取得
 * 本番環境では汎用メッセージを返す
 */
export function getSafeErrorMessage(error: unknown): string {
  if (isProduction) {
    return 'エラーが発生しました。しばらく時間をおいて再度お試しください。';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '不明なエラーが発生しました';
}
