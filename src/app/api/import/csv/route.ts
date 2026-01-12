import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { query, transaction, queryWithClient } from '@/lib/db';
import { PoolClient, QueryResultRow } from 'pg';

// ============================================================
// 型定義
// ============================================================

interface CsvRow {
  category: string;
  year_month: string;
  value: string;
  data_type: string;
}

interface ValidatedRow {
  category: string;
  yearMonth: string;
  value: number;
  dataType: 'sales' | 'volume' | 'price';
}

interface DuplicateCheckResult extends QueryResultRow {
  category: string;
  year_month: string;
  data_type: string;
}

interface RowValidationResult {
  valid: boolean;
  row?: ValidatedRow;
  error?: string;
  rowIndex: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

interface FileValidationResult {
  valid: boolean;
  error?: { message: string; code: string };
  file?: File;
  overwrite?: boolean;
}

interface ParsedCsvResult {
  validRows: ValidatedRow[];
  errors: string[];
}

// ============================================================
// 定数
// ============================================================

const ALLOWED_CATEGORIES: string[] = [
  'ワイン', '日本酒', 'ビール', '焼酎', 'ウイスキー', 'シードル', '果実酒',
];

const ALLOWED_DATA_TYPES: string[] = ['sales', 'volume', 'price'];
const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_ERRORS_RETURN = 50;
const MAX_ERRORS_LIMIT = 100;

// ============================================================
// サニタイゼーション
// ============================================================

function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input.trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 255);
}

function sanitizeNumber(input: string): number | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const num = parseFloat(trimmed);
  return isNaN(num) || !isFinite(num) ? null : num;
}

// ============================================================
// バリデーション - 個別フィールド
// ============================================================

function validateCategory(category: string, rowIndex: number): RowValidationResult | null {
  if (!category) {
    return { valid: false, error: `行 ${rowIndex + 1}: カテゴリーが空です`, rowIndex };
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return {
      valid: false,
      error: `行 ${rowIndex + 1}: 無効なカテゴリー "${category}"`,
      rowIndex,
    };
  }
  return null;
}

function validateYearMonth(yearMonth: string, rowIndex: number): RowValidationResult | null {
  if (!yearMonth) {
    return { valid: false, error: `行 ${rowIndex + 1}: 年月が空です`, rowIndex };
  }
  if (!YEAR_MONTH_REGEX.test(yearMonth)) {
    return {
      valid: false,
      error: `行 ${rowIndex + 1}: 無効な年月フォーマット "${yearMonth}"`,
      rowIndex,
    };
  }
  return null;
}

function validateValue(value: number | null, rawValue: string, rowIndex: number): RowValidationResult | null {
  if (value === null) {
    return { valid: false, error: `行 ${rowIndex + 1}: 値が無効です "${rawValue}"`, rowIndex };
  }
  if (value < 0) {
    return { valid: false, error: `行 ${rowIndex + 1}: 値は0以上の数値である必要があります`, rowIndex };
  }
  return null;
}

function validateDataType(dataType: string, rowIndex: number): RowValidationResult | null {
  if (!dataType) {
    return { valid: false, error: `行 ${rowIndex + 1}: データタイプが空です`, rowIndex };
  }
  if (!ALLOWED_DATA_TYPES.includes(dataType)) {
    return {
      valid: false,
      error: `行 ${rowIndex + 1}: 無効なデータタイプ "${dataType}"`,
      rowIndex,
    };
  }
  return null;
}

// ============================================================
// バリデーション - 行レベル
// ============================================================

function validateRow(row: CsvRow, rowIndex: number): RowValidationResult {
  const category = sanitizeString(row.category || '');
  const categoryError = validateCategory(category, rowIndex);
  if (categoryError) return categoryError;

  const yearMonth = sanitizeString(row.year_month || '');
  const yearMonthError = validateYearMonth(yearMonth, rowIndex);
  if (yearMonthError) return yearMonthError;

  const value = sanitizeNumber(row.value || '');
  const valueError = validateValue(value, row.value || '', rowIndex);
  if (valueError) return valueError;

  const dataType = sanitizeString(row.data_type || '').toLowerCase();
  const dataTypeError = validateDataType(dataType, rowIndex);
  if (dataTypeError) return dataTypeError;

  return {
    valid: true,
    row: { category, yearMonth, value: value!, dataType: dataType as 'sales' | 'volume' | 'price' },
    rowIndex,
  };
}

function validateHeaders(headers: string[]): { valid: boolean; error?: string } {
  const requiredHeaders = ['category', 'year_month', 'value', 'data_type'];
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  const missingHeaders = requiredHeaders.filter((h) => !normalizedHeaders.includes(h));
  if (missingHeaders.length > 0) {
    return { valid: false, error: `必須ヘッダーが不足しています: ${missingHeaders.join(', ')}` };
  }
  return { valid: true };
}

// ============================================================
// データベース操作
// ============================================================

async function checkDuplicates(rows: ValidatedRow[]): Promise<Map<string, DuplicateCheckResult>> {
  if (rows.length === 0) return new Map();

  const conditions: string[] = [];
  const params: string[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    conditions.push(
      `(category = $${paramIndex} AND year_month = $${paramIndex + 1} AND data_type = $${paramIndex + 2})`
    );
    params.push(row.category, row.yearMonth, row.dataType);
    paramIndex += 3;
  }

  const result = await query<DuplicateCheckResult>(
    `SELECT category, year_month, data_type FROM market_data WHERE ${conditions.join(' OR ')}`,
    params
  );

  const duplicateMap = new Map<string, DuplicateCheckResult>();
  for (const row of result.rows) {
    duplicateMap.set(`${row.category}|${row.year_month}|${row.data_type}`, row);
  }
  return duplicateMap;
}

async function saveRowWithUpsert(client: PoolClient, row: ValidatedRow): Promise<void> {
  await queryWithClient(
    client,
    `INSERT INTO market_data (category, year_month, value, data_type, source)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (category, year_month, data_type)
     DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP`,
    [row.category, row.yearMonth, row.value, row.dataType, 'manual']
  );
}

async function saveRowInsertOnly(client: PoolClient, row: ValidatedRow): Promise<boolean> {
  try {
    await queryWithClient(
      client,
      `INSERT INTO market_data (category, year_month, value, data_type, source) VALUES ($1, $2, $3, $4, $5)`,
      [row.category, row.yearMonth, row.value, row.dataType, 'manual']
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    const isDuplicate = errorMessage.includes('duplicate') ||
      errorMessage.includes('unique') || errorMessage.includes('23505');
    if (isDuplicate) return false;
    throw error;
  }
}

async function saveDataToDB(
  client: PoolClient, rows: ValidatedRow[], overwrite: boolean
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (overwrite) {
      await saveRowWithUpsert(client, row);
      imported++;
    } else {
      const success = await saveRowInsertOnly(client, row);
      if (success) imported++;
      else skipped++;
    }
  }
  return { imported, skipped };
}

// ============================================================
// CSVパース
// ============================================================

function collectParseErrors(parseResult: Papa.ParseResult<CsvRow>): string[] {
  return parseResult.errors.map((error) =>
    `CSVパースエラー (行 ${error.row !== undefined ? error.row + 2 : '?'}): ${error.message}`
  );
}

function validateAndCollectRows(data: CsvRow[]): ParsedCsvResult {
  const errors: string[] = [];
  const validRows: ValidatedRow[] = [];

  for (let i = 0; i < data.length; i++) {
    const validation = validateRow(data[i], i);
    if (validation.valid && validation.row) {
      validRows.push(validation.row);
    } else if (validation.error) {
      errors.push(validation.error);
    }
  }
  return { validRows, errors };
}

function parseCsvContent(csvContent: string): ParsedCsvResult {
  const parseResult = Papa.parse<CsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.toLowerCase().trim(),
  });

  const errors = collectParseErrors(parseResult);

  const headerValidation = validateHeaders(parseResult.meta.fields || []);
  if (!headerValidation.valid) {
    return { validRows: [], errors: [...errors, headerValidation.error || 'ヘッダーエラー'] };
  }

  if (parseResult.data.length > MAX_ROWS) {
    return { validRows: [], errors: [...errors, `行数が上限を超えています。最大: ${MAX_ROWS}行`] };
  }

  const rowValidation = validateAndCollectRows(parseResult.data);
  return { validRows: rowValidation.validRows, errors: [...errors, ...rowValidation.errors] };
}

// ============================================================
// リクエストバリデーション
// ============================================================

function validateContentType(contentType: string): ErrorResponse | null {
  if (!contentType.includes('multipart/form-data')) {
    return { success: false, error: 'Content-Type must be multipart/form-data', code: 'INVALID_CONTENT_TYPE' };
  }
  return null;
}

function validateFile(file: FormDataEntryValue | null): ErrorResponse | null {
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'ファイルが指定されていません', code: 'MISSING_FILE' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `ファイルサイズが上限を超えています。最大: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      code: 'FILE_TOO_LARGE',
    };
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { success: false, error: 'CSVファイル（.csv）のみ許可されています', code: 'INVALID_FILE_TYPE' };
  }
  return null;
}

async function validateRequest(request: NextRequest): Promise<FileValidationResult> {
  const contentType = request.headers.get('content-type') || '';
  const contentTypeError = validateContentType(contentType);
  if (contentTypeError) {
    return { valid: false, error: { message: contentTypeError.error, code: contentTypeError.code } };
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const fileError = validateFile(file);
  if (fileError) {
    return { valid: false, error: { message: fileError.error, code: fileError.code } };
  }

  const overwriteParam = formData.get('overwrite');
  const overwrite = overwriteParam === 'true' || overwriteParam === '1';

  return { valid: true, file: file as File, overwrite };
}

// ============================================================
// レスポンス生成
// ============================================================

function createErrorResponse(error: string, code: string, status: number): NextResponse<ErrorResponse> {
  return NextResponse.json({ success: false, error, code }, { status });
}

function createSuccessResponse(imported: number, skipped: number, errors: string[]): NextResponse<ImportResult> {
  return NextResponse.json({
    success: true,
    imported,
    skipped,
    errors: errors.slice(0, MAX_ERRORS_RETURN),
  });
}

// ============================================================
// APIハンドラー
// ============================================================

async function processImport(file: File, overwrite: boolean): Promise<NextResponse<ImportResult | ErrorResponse>> {
  const csvContent = await file.text();
  const { validRows, errors } = parseCsvContent(csvContent);

  if (errors.length > MAX_ERRORS_LIMIT) {
    return createErrorResponse(
      `バリデーションエラーが多すぎます（${errors.length}件）`,
      'TOO_MANY_ERRORS',
      400
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      success: false,
      imported: 0,
      skipped: 0,
      errors: errors.length > 0 ? errors : ['有効なデータ行がありません'],
    }, { status: 400 });
  }

  if (!overwrite) {
    await checkDuplicates(validRows);
  }

  const result = await transaction(async (client) => saveDataToDB(client, validRows, overwrite));
  return createSuccessResponse(result.imported, result.skipped, errors);
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult | ErrorResponse>> {
  try {
    const validation = await validateRequest(request);
    if (!validation.valid) {
      return createErrorResponse(validation.error!.message, validation.error!.code, 400);
    }

    return await processImport(validation.file!, validation.overwrite!);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('CSV import error:', errorMessage);

    const isProduction = process.env.NODE_ENV === 'production';
    return createErrorResponse(
      isProduction ? 'Internal server error' : errorMessage,
      'INTERNAL_ERROR',
      500
    );
  }
}
