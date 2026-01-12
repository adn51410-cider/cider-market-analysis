import { createHash } from 'crypto';
import { query } from './db';

// ============================================================
// 型定義
// ============================================================

/**
 * e-Stat APIリクエストパラメータ
 */
export interface EstatApiParams {
  statsDataId: string;        // 統計表ID
  cdCat01?: string;           // 分類コード01
  cdCat02?: string;           // 分類コード02
  cdTime?: string;            // 時間軸コード
  cdTimeFrom?: string;        // 時間軸開始コード
  cdTimeTo?: string;          // 時間軸終了コード
  startPosition?: number;     // 開始位置
  limit?: number;             // 取得件数
  metaGetFlg?: 'Y' | 'N';     // メタ情報取得フラグ
  cntGetFlg?: 'Y' | 'N';      // 件数取得フラグ
  explanationGetFlg?: 'Y' | 'N'; // 解説情報取得フラグ
  annotationGetFlg?: 'Y' | 'N'; // 注釈情報取得フラグ
}

/**
 * e-Stat APIレスポンス（簡略化）
 */
export interface EstatApiResponse {
  GET_STATS_DATA: {
    RESULT: {
      STATUS: number;
      ERROR_MSG?: string;
      DATE: string;
    };
    PARAMETER: Record<string, unknown>;
    STATISTICAL_DATA?: {
      RESULT_INF?: {
        TOTAL_NUMBER: number;
        FROM_NUMBER?: number;
        TO_NUMBER?: number;
        NEXT_KEY?: number;
      };
      CLASS_INF?: {
        CLASS_OBJ: ClassObject[];
      };
      DATA_INF?: {
        NOTE?: NoteInfo[];
        VALUE: ValueData[];
      };
    };
  };
}

interface ClassObject {
  '@id': string;
  '@name': string;
  CLASS: ClassItem[] | ClassItem;
}

interface ClassItem {
  '@code': string;
  '@name': string;
  '@level'?: string;
  '@unit'?: string;
  '@parentCode'?: string;
}

interface NoteInfo {
  '@char': string;
  $: string;
}

interface ValueData {
  '@tab'?: string;
  '@cat01'?: string;
  '@cat02'?: string;
  '@time'?: string;
  '@unit'?: string;
  $: string;
}

/**
 * MarketData形式（変換後）
 */
export interface MarketDataRow {
  category: string;
  yearMonth: string;
  value: number;
  dataType: 'sales' | 'volume' | 'price';
  source: 'estat' | 'manual';
}

/**
 * キャッシュされたレスポンス
 */
interface CachedResponse {
  cache_key: string;
  endpoint: string;
  params: EstatApiParams;
  response: EstatApiResponse;
  expires_at: Date;
  created_at: Date;
}

/**
 * エラー種別
 */
export enum EstatApiErrorType {
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  API_ERROR = 'API_ERROR',
  VALIDATION = 'VALIDATION',
  PARSE_ERROR = 'PARSE_ERROR',
}

/**
 * カスタムエラークラス
 */
export class EstatApiError extends Error {
  public readonly type: EstatApiErrorType;
  public readonly statusCode?: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    type: EstatApiErrorType,
    statusCode?: number,
    originalError?: Error
  ) {
    super(message);
    this.name = 'EstatApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

// ============================================================
// 定数
// ============================================================

const ESTAT_API_BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData';
const REQUEST_TIMEOUT_MS = 10000;           // 10秒タイムアウト
const MAX_RETRIES = 3;                       // 最大リトライ回数
const BASE_RETRY_DELAY_MS = 1000;           // 基本リトライ遅延（1秒）
const CACHE_TTL_MINUTES = 5;                // キャッシュ有効期限（5分）

// 酒類カテゴリーマッピング（e-Stat分類コード → 表示名）
export const CATEGORY_MAPPING: Record<string, string> = {
  '5310': 'ワイン',           // 果実酒（ワイン含む）
  '5311': 'ワイン',           // ワイン
  '5312': 'シードル',         // シードル・その他果実酒
  '5320': '日本酒',           // 清酒
  '5330': 'ビール',           // ビール
  '5340': '焼酎',             // 焼酎
  '5350': 'ウイスキー',       // ウイスキー
};

// データタイプマッピング
export const DATATYPE_MAPPING: Record<string, 'sales' | 'volume' | 'price'> = {
  '001': 'sales',    // 金額
  '002': 'volume',   // 数量
  '003': 'price',    // 単価
};

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * パラメータからキャッシュキー（SHA256ハッシュ）を生成
 * @param endpoint APIエンドポイント
 * @param params リクエストパラメータ
 * @returns ハッシュ文字列
 */
export function generateCacheKey(endpoint: string, params: EstatApiParams): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key as keyof EstatApiParams];
      if (value !== undefined) {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>);

  const payload = JSON.stringify({ endpoint, params: sortedParams });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 指数バックオフ付きスリープ
 * @param attempt 試行回数（0始まり）
 */
async function exponentialBackoff(attempt: number): Promise<void> {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * タイムアウト付きfetch
 * @param url リクエストURL
 * @param timeoutMs タイムアウト時間（ミリ秒）
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 月を検証してフォーマットする
 */
function formatYearMonth(year: string, month: string): string {
  const monthNum = parseInt(month, 10);
  if (monthNum >= 1 && monthNum <= 12) {
    return `${year}-${month.padStart(2, '0')}`;
  }
  return `${year}-01`;
}

/**
 * 10桁の時間軸コードを解析
 */
function parseTenDigitTimeCode(timeCode: string): string | null {
  const year = timeCode.substring(0, 4);

  // パターン1: "2020000101" 形式 (YYYY0000MMDD)
  if (timeCode.substring(4, 8) === '0000') {
    const month = timeCode.substring(8, 10);
    return formatYearMonth(year, month);
  }

  // パターン2: "2020000601" 形式 (YYYY00MMDD)
  if (timeCode.substring(4, 6) === '00') {
    const month = timeCode.substring(6, 8);
    return formatYearMonth(year, month);
  }

  return null;
}

/**
 * 時間軸コードをYYYY-MM形式に変換
 * e-Statの時間軸形式には複数のパターンがある:
 * - "2020000101" → "2020-01" (年+0000+月+日)
 * - "2020000601" → "2020-06"
 * - "202001" → "2020-01" (年月)
 * - "2020" → "2020-01" (年のみ)
 */
export function parseTimeCode(timeCode: string): string {
  if (!timeCode) {
    return '';
  }

  // 10桁パターン
  if (timeCode.length === 10) {
    const result = parseTenDigitTimeCode(timeCode);
    if (result) return result;
  }

  // 6桁パターン: "202001" (YYYYMM)
  if (timeCode.length === 6) {
    const year = timeCode.substring(0, 4);
    const month = timeCode.substring(4, 6);
    return formatYearMonth(year, month);
  }

  // 4桁パターン: "2020" (YYYY)
  if (timeCode.length === 4) {
    return `${timeCode}-01`;
  }

  // その他: 最初の4文字を年として扱う
  if (timeCode.length >= 4) {
    return `${timeCode.substring(0, 4)}-01`;
  }

  return `${timeCode}-01`;
}

// ============================================================
// キャッシュ機構
// ============================================================

/**
 * キャッシュからレスポンスを取得
 * @param cacheKey キャッシュキー
 * @returns キャッシュされたレスポンス、なければnull
 */
async function getCachedResponse(cacheKey: string): Promise<EstatApiResponse | null> {
  try {
    const result = await query<CachedResponse>(
      `SELECT * FROM api_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );

    if (result.rows.length > 0) {
      return result.rows[0].response as EstatApiResponse;
    }
    return null;
  } catch (error) {
    // キャッシュ取得エラーは無視してAPI呼び出しに進む
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Cache lookup failed:', error);
    }
    return null;
  }
}

/**
 * レスポンスをキャッシュに保存
 * @param cacheKey キャッシュキー
 * @param endpoint エンドポイント
 * @param params パラメータ
 * @param response レスポンス
 */
async function setCachedResponse(
  cacheKey: string,
  endpoint: string,
  params: EstatApiParams,
  response: EstatApiResponse
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO api_cache (cache_key, endpoint, params, response, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cache_key)
       DO UPDATE SET
         response = EXCLUDED.response,
         expires_at = EXCLUDED.expires_at`,
      [cacheKey, endpoint, JSON.stringify(params), JSON.stringify(response), expiresAt]
    );
  } catch (error) {
    // キャッシュ保存エラーは無視（ログのみ）
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn('Cache save failed:', error);
    }
  }
}

/**
 * 期限切れキャッシュをクリーンアップ（定期実行用）
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM api_cache WHERE expires_at < NOW()`
    );
    return result.rowCount || 0;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Cache cleanup failed:', error);
    }
    return 0;
  }
}

// ============================================================
// e-Stat API クライアント
// ============================================================

/**
 * URLパラメータを構築
 */
function buildUrlParams(apiKey: string, params: EstatApiParams): string {
  const urlParams = new URLSearchParams({ appId: apiKey });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.append(key, String(value));
    }
  });
  return urlParams.toString();
}

/**
 * APIレスポンスを検証
 */
function validateResponse(response: Response): void {
  if (response.status === 429) {
    throw new EstatApiError('Rate limit exceeded', EstatApiErrorType.RATE_LIMIT, 429);
  }
  if (!response.ok) {
    throw new EstatApiError(
      `HTTP error: ${response.status} ${response.statusText}`,
      EstatApiErrorType.API_ERROR,
      response.status
    );
  }
}

/**
 * e-Stat APIレスポンスデータを検証
 */
function validateApiData(data: EstatApiResponse): void {
  if (data.GET_STATS_DATA.RESULT.STATUS !== 0) {
    throw new EstatApiError(
      data.GET_STATS_DATA.RESULT.ERROR_MSG || 'Unknown API error',
      EstatApiErrorType.API_ERROR,
      data.GET_STATS_DATA.RESULT.STATUS
    );
  }
}

/**
 * エラーを処理してリトライ可否を判断
 */
async function handleApiError(
  error: unknown,
  cacheKey: string
): Promise<{ shouldRetry: boolean; response?: EstatApiResponse; lastError: Error }> {
  const lastError = error instanceof Error ? error : new Error(String(error));

  // タイムアウトエラー
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      shouldRetry: true,
      lastError: new EstatApiError('Request timeout', EstatApiErrorType.TIMEOUT, undefined, error),
    };
  }

  // レート制限エラー時はキャッシュから返却を試みる
  if (error instanceof EstatApiError && error.type === EstatApiErrorType.RATE_LIMIT) {
    const staleCache = await getStaleCache(cacheKey);
    if (staleCache) {
      return { shouldRetry: false, response: staleCache, lastError };
    }
  }

  // リトライ不可能なエラー
  if (error instanceof EstatApiError) {
    if (error.type === EstatApiErrorType.VALIDATION || error.type === EstatApiErrorType.PARSE_ERROR) {
      throw error;
    }
  }

  return { shouldRetry: true, lastError };
}

/**
 * 単一のAPI呼び出しを実行
 */
async function executeApiCall(url: string): Promise<EstatApiResponse> {
  const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
  validateResponse(response);
  const data: EstatApiResponse = await response.json();
  validateApiData(data);
  return data;
}

/**
 * リトライループを実行
 */
async function executeWithRetry(
  url: string,
  cacheKey: string,
  endpoint: string,
  params: EstatApiParams
): Promise<EstatApiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await exponentialBackoff(attempt - 1);
      const data = await executeApiCall(url);
      await setCachedResponse(cacheKey, endpoint, params, data);
      return data;
    } catch (error) {
      const result = await handleApiError(error, cacheKey);
      lastError = result.lastError;
      if (result.response) return result.response;
      if (!result.shouldRetry) throw lastError;
    }
  }

  throw new EstatApiError(
    `Failed after ${MAX_RETRIES} retries: ${lastError?.message || 'Unknown error'}`,
    EstatApiErrorType.NETWORK,
    undefined,
    lastError || undefined
  );
}

/**
 * e-Stat APIにリクエストを送信（リトライ・キャッシュ付き）
 * @param params リクエストパラメータ
 * @returns APIレスポンス
 */
export async function fetchEstatData(params: EstatApiParams): Promise<EstatApiResponse> {
  const apiKey = process.env.ESTAT_API_KEY;
  if (!apiKey) {
    throw new EstatApiError('ESTAT_API_KEY environment variable is not set', EstatApiErrorType.VALIDATION);
  }

  const endpoint = ESTAT_API_BASE_URL;
  const cacheKey = generateCacheKey(endpoint, params);

  const cachedResponse = await getCachedResponse(cacheKey);
  if (cachedResponse) return cachedResponse;

  const url = `${endpoint}?${buildUrlParams(apiKey, params)}`;
  return executeWithRetry(url, cacheKey, endpoint, params);
}

/**
 * 期限切れでもキャッシュを取得（レート制限時のフォールバック用）
 */
async function getStaleCache(cacheKey: string): Promise<EstatApiResponse | null> {
  try {
    const result = await query<CachedResponse>(
      `SELECT * FROM api_cache WHERE cache_key = $1`,
      [cacheKey]
    );

    if (result.rows.length > 0) {
      return result.rows[0].response as EstatApiResponse;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// データ変換
// ============================================================

// 無効な値のパターン
const INVALID_VALUES = ['-', '***', '...'];

/**
 * 値が有効かどうかを判定
 */
function isValidValue(value: string | undefined): boolean {
  if (!value) return false;
  return !INVALID_VALUES.includes(value);
}

/**
 * 数値を解析
 */
function parseNumericValue(value: string): number | null {
  const numericValue = parseFloat(value.replace(/,/g, ''));
  return isNaN(numericValue) ? null : numericValue;
}

/**
 * カテゴリーを解決
 */
function resolveCategory(
  categoryCode: string,
  classMapping: Record<string, string>
): string {
  if (CATEGORY_MAPPING[categoryCode]) {
    return CATEGORY_MAPPING[categoryCode];
  }
  if (classMapping[categoryCode]) {
    return classMapping[categoryCode];
  }
  return 'その他';
}

/**
 * 単一の値データをMarketDataRowに変換
 */
function convertValueToMarketData(
  value: ValueData,
  classMapping: Record<string, string>,
  defaultDataType: 'sales' | 'volume' | 'price'
): MarketDataRow | null {
  if (!isValidValue(value.$)) return null;

  const numericValue = parseNumericValue(value.$!);
  if (numericValue === null) return null;

  const categoryCode = value['@cat01'] || value['@cat02'] || '';
  const category = resolveCategory(categoryCode, classMapping);
  const yearMonth = parseTimeCode(value['@time'] || '');
  const tabCode = value['@tab'] || '';
  const dataType = DATATYPE_MAPPING[tabCode] || defaultDataType;

  return { category, yearMonth, value: numericValue, dataType, source: 'estat' };
}

/**
 * e-Stat APIレスポンスをMarketData形式に変換
 * @param response e-Stat APIレスポンス
 * @param defaultDataType デフォルトのデータタイプ
 * @returns MarketData配列
 */
export function transformEstatResponse(
  response: EstatApiResponse,
  defaultDataType: 'sales' | 'volume' | 'price' = 'sales'
): MarketDataRow[] {
  const statisticalData = response.GET_STATS_DATA.STATISTICAL_DATA;
  if (!statisticalData?.DATA_INF?.VALUE) {
    return [];
  }

  const classMapping = buildClassMapping(statisticalData.CLASS_INF?.CLASS_OBJ);

  return statisticalData.DATA_INF.VALUE
    .map((value) => convertValueToMarketData(value, classMapping, defaultDataType))
    .filter((item): item is MarketDataRow => item !== null);
}

/**
 * 分類オブジェクトからコード→名前のマッピングを構築
 */
function buildClassMapping(classObjects?: ClassObject[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  if (!classObjects) {
    return mapping;
  }

  for (const obj of classObjects) {
    const classes = Array.isArray(obj.CLASS) ? obj.CLASS : [obj.CLASS];
    for (const cls of classes) {
      if (cls['@code'] && cls['@name']) {
        mapping[cls['@code']] = cls['@name'];
      }
    }
  }

  return mapping;
}

// ============================================================
// 家計調査データ取得（高レベルAPI）
// ============================================================

/**
 * 家計調査の酒類データを取得（メイン関数）
 * @param options 取得オプション
 * @returns 変換済みMarketData配列
 */
export async function fetchHouseholdSurveyAlcoholData(options: {
  fromYear?: number;
  toYear?: number;
  categories?: string[];
}): Promise<MarketDataRow[]> {
  const { fromYear, toYear, categories } = options;

  // 家計調査の酒類関連統計表ID
  // 00200561 - 家計調査 / 家計収支編 / 二人以上の世帯
  const statsDataId = '0002070001'; // 家計調査 品目分類（2020年改定）

  const params: EstatApiParams = {
    statsDataId,
    metaGetFlg: 'Y',
    cntGetFlg: 'Y',
  };

  // 時間範囲の設定
  if (fromYear) {
    params.cdTimeFrom = `${fromYear}000101`;
  }
  if (toYear) {
    params.cdTimeTo = `${toYear}001231`;
  }

  try {
    const response = await fetchEstatData(params);
    let marketData = transformEstatResponse(response);

    // カテゴリーフィルタリング
    if (categories && categories.length > 0) {
      marketData = marketData.filter((item) =>
        categories.includes(item.category)
      );
    }

    return marketData;
  } catch (error) {
    if (error instanceof EstatApiError) {
      throw error;
    }
    throw new EstatApiError(
      `Failed to fetch household survey data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      EstatApiErrorType.NETWORK,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}
