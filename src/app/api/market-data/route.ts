import { NextRequest, NextResponse } from 'next/server';
import { AlcoholCategory } from '@/types';
import { query, transaction } from '@/lib/db';
import {
  fetchEstatData,
  transformEstatResponse,
  EstatApiError,
  EstatApiErrorType,
  MarketDataRow,
  EstatApiParams,
} from '@/lib/estatApi';
import { PoolClient, QueryResultRow } from 'pg';

// ============================================================
// 型定義
// ============================================================

interface MarketDataDBRow extends QueryResultRow {
  id: string;
  category: string;
  year_month: string;
  value: string;
  data_type: string;
  source: string;
  created_at: Date;
  updated_at: Date;
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
  data: MarketDataResponse[];
  meta: {
    totalCount: number;
    categories: string[];
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ============================================================
// 定数
// ============================================================

// 許可されたカテゴリーリスト
const VALID_CATEGORIES: string[] = Object.values(AlcoholCategory);

// 年月フォーマット正規表現 (YYYY-MM)
const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// ============================================================
// バリデーション
// ============================================================

/**
 * 年月形式のバリデーション
 */
function isValidYearMonth(yearMonth: string): boolean {
  return YEAR_MONTH_REGEX.test(yearMonth);
}

/**
 * カテゴリーのバリデーション
 */
function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category);
}

/**
 * 年月を比較 (a <= b なら true)
 */
function isValidDateRange(from: string, to: string): boolean {
  return from <= to;
}

/**
 * 年月からe-Stat時間軸コードに変換
 * 例: "2024-01" → "2024000101"
 * 形式: YYYY00MMDD (MMとDDは同じ値)
 */
function yearMonthToEstatTimeCode(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}00${month}${month}`;
}

// 酒類カテゴリコード（e-Stat品目分類 2025年改定版）
const ALCOHOL_CATEGORY_CODES = [
  '011100000',  // 酒類（合計）
  '011100010',  // 清酒
  '011100030',  // ビール
  '011100040',  // ウイスキー
  '011100050',  // ワイン
  '011100060',  // 発泡酒
  '011100080',  // 他の酒（シードル含む）- 2025年改定版では011100080
];

// ============================================================
// データベース操作
// ============================================================

/**
 * DBからmarket_dataを検索
 */
async function getMarketDataFromDB(
  categories: string[],
  from: string,
  to: string
): Promise<MarketDataDBRow[]> {
  const placeholders = categories.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<MarketDataDBRow>(
    `SELECT * FROM market_data
     WHERE category IN (${placeholders})
       AND year_month >= $${categories.length + 1}
       AND year_month <= $${categories.length + 2}
     ORDER BY category, year_month`,
    [...categories, from, to]
  );
  return result.rows;
}

/**
 * e-Statから取得したデータをDBに保存
 * トランザクション内で実行
 */
async function saveMarketDataToDB(
  client: PoolClient,
  data: MarketDataRow[]
): Promise<void> {
  for (const row of data) {
    await client.query(
      `INSERT INTO market_data (category, year_month, value, data_type, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category, year_month, data_type)
       DO UPDATE SET
         value = EXCLUDED.value,
         source = EXCLUDED.source,
         updated_at = CURRENT_TIMESTAMP`,
      [row.category, row.yearMonth, row.value, row.dataType, row.source]
    );
  }
}

/**
 * DBの結果をAPI用レスポンス形式に変換
 */
function dbRowToResponse(row: MarketDataDBRow): MarketDataResponse {
  return {
    id: row.id,
    category: row.category,
    yearMonth: row.year_month,
    value: parseFloat(row.value),
    dataType: row.data_type,
    source: row.source,
  };
}

// ============================================================
// e-Stat API連携
// ============================================================

/**
 * e-Stat APIからデータを取得してDBに保存
 */
async function fetchAndSaveEstatData(
  categories: string[],
  from: string,
  to: string
): Promise<MarketDataRow[]> {
  const params: EstatApiParams = {
    statsDataId: '0004023601', // 家計調査 品目分類（2025年改定）- 月次データ（〜2025年11月）
    startPosition: 1,  // データ取得に必須
    limit: 10000,      // 十分な件数を取得
    cdTimeFrom: yearMonthToEstatTimeCode(from),
    cdTimeTo: yearMonthToEstatTimeCode(to),
    cdCat01: ALCOHOL_CATEGORY_CODES.join(','),  // 酒類カテゴリのみ取得
    cdArea: '00000',  // 全国
    cdCat02: '03',    // 二人以上の世帯
  };

  const response = await fetchEstatData(params);
  let marketData = transformEstatResponse(response);

  // カテゴリーでフィルタリング（ユーザー指定のカテゴリに絞り込む）
  marketData = marketData.filter((item) => categories.includes(item.category));

  // 期間でフィルタリング
  marketData = marketData.filter(
    (item) => item.yearMonth >= from && item.yearMonth <= to
  );

  // DBに保存（トランザクション内）
  if (marketData.length > 0) {
    await transaction(async (client) => {
      await saveMarketDataToDB(client, marketData);
    });
  }

  return marketData;
}

// ============================================================
// バリデーション結果型
// ============================================================

interface ValidationSuccess {
  valid: true;
  from: string;
  to: string;
  categories: string[];
}

interface ValidationError {
  valid: false;
  error: string;
  code: string;
}

type ValidationResult = ValidationSuccess | ValidationError;

/**
 * リクエストパラメータのバリデーション
 */
function validateRequestParams(searchParams: URLSearchParams): ValidationResult {
  const categoryParam = searchParams.get('category');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // 必須パラメータのバリデーション
  if (!from || !to) {
    return {
      valid: false,
      error: 'Missing required parameters: from, to',
      code: 'MISSING_PARAMETERS',
    };
  }

  // 年月フォーマットのバリデーション
  if (!isValidYearMonth(from) || !isValidYearMonth(to)) {
    return {
      valid: false,
      error: 'Invalid date format. Expected YYYY-MM',
      code: 'INVALID_DATE_FORMAT',
    };
  }

  // 期間のバリデーション
  if (!isValidDateRange(from, to)) {
    return {
      valid: false,
      error: 'Invalid date range. from must be before or equal to to',
      code: 'INVALID_DATE_RANGE',
    };
  }

  // カテゴリーの解析（複数カテゴリー対応：カンマ区切り）
  let categories: string[] = [];
  if (categoryParam) {
    categories = categoryParam.split(',').map((c) => c.trim());

    // 各カテゴリーのバリデーション
    const invalidCategories = categories.filter((c) => !isValidCategory(c));
    if (invalidCategories.length > 0) {
      return {
        valid: false,
        error: `Invalid categories: ${invalidCategories.join(', ')}`,
        code: 'INVALID_CATEGORY',
      };
    }
  } else {
    // カテゴリー未指定の場合は全カテゴリー（「その他」を除く）
    categories = VALID_CATEGORIES.filter((c) => c !== AlcoholCategory.OTHER);
  }

  return { valid: true, from, to, categories };
}

/**
 * 市場データを取得（DBまたはe-Stat API）
 */
async function fetchMarketData(
  categories: string[],
  from: string,
  to: string
): Promise<{ data: MarketDataDBRow[]; error?: { message: string; type: EstatApiErrorType } }> {
  // まずDBから検索
  let dbData = await getMarketDataFromDB(categories, from, to);

  // DBにデータがない場合、e-Stat APIから取得
  if (dbData.length === 0) {
    try {
      const estatData = await fetchAndSaveEstatData(categories, from, to);

      // 保存後、再度DBから取得（IDを取得するため）
      if (estatData.length > 0) {
        dbData = await getMarketDataFromDB(categories, from, to);
      }
    } catch (error) {
      if (error instanceof EstatApiError) {
        return { data: [], error: { message: error.message, type: error.type } };
      }
      throw error;
    }
  }

  return { data: dbData };
}

/**
 * 成功レスポンスを構築
 */
function buildSuccessResponse(dbData: MarketDataDBRow[]): ApiResponse {
  const responseData: MarketDataResponse[] = dbData.map(dbRowToResponse);
  const uniqueCategories = [...new Set(responseData.map((d) => d.category))];

  return {
    success: true,
    data: responseData,
    meta: {
      totalCount: responseData.length,
      categories: uniqueCategories,
    },
  };
}

// ============================================================
// APIハンドラー
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse | ErrorResponse>> {
  try {
    // バリデーション
    const validation = validateRequestParams(request.nextUrl.searchParams);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const { from, to, categories } = validation;

    // データ取得
    const result = await fetchMarketData(categories, from, to);
    if (result.error) {
      const statusCode = result.error.type === EstatApiErrorType.RATE_LIMIT ? 429 : 502;
      return NextResponse.json(
        { success: false, error: `e-Stat API error: ${result.error.message}`, code: result.error.type },
        { status: statusCode }
      );
    }

    // 成功レスポンス
    return NextResponse.json(buildSuccessResponse(result.data));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Market data API error:', errorMessage);

    const isProduction = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { success: false, error: isProduction ? 'Internal server error' : errorMessage, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
