/**
 * 市場データ取得用TanStack Query Hook
 *
 * /api/market-data エンドポイントからデータを取得し、
 * グラフ表示用の形式に変換する
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { AlcoholCategory } from '@/types';

// ============================================================
// 型定義
// ============================================================

/** APIレスポンスの個別データ */
export interface MarketDataItem {
  id: string;
  category: string;
  yearMonth: string;
  value: number;
  dataType: string;
  source: string;
}

/** APIレスポンス */
export interface MarketDataApiResponse {
  success: boolean;
  data: MarketDataItem[];
  meta: {
    totalCount: number;
    categories: string[];
  };
}

/** エラーレスポンス */
export interface MarketDataApiError {
  success: false;
  error: string;
  code?: string;
}

/** Hook用パラメータ */
export interface UseMarketDataParams {
  categories: AlcoholCategory[];
  from: string;
  to: string;
  enabled?: boolean;
}

/** グラフ表示用データ行 */
export interface ChartDataRow {
  yearMonth: string;
  [key: string]: string | number;
}

// ============================================================
// データ取得・変換関数
// ============================================================

/**
 * 市場データAPIを呼び出す
 */
async function fetchMarketData(
  categories: AlcoholCategory[],
  from: string,
  to: string
): Promise<MarketDataApiResponse> {
  const params = new URLSearchParams({
    category: categories.join(','),
    from,
    to,
  });

  const response = await fetch(`/api/market-data?${params.toString()}`);

  if (!response.ok) {
    const errorData: MarketDataApiError = await response.json();
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

/**
 * APIレスポンスをグラフ表示用形式に変換
 *
 * 入力形式:
 * [
 *   { yearMonth: '2024-01', category: 'ワイン', value: 500 },
 *   { yearMonth: '2024-01', category: '日本酒', value: 400 },
 *   { yearMonth: '2024-02', category: 'ワイン', value: 520 },
 *   ...
 * ]
 *
 * 出力形式:
 * [
 *   { yearMonth: '2024-01', 'ワイン': 500, '日本酒': 400 },
 *   { yearMonth: '2024-02', 'ワイン': 520, ... },
 *   ...
 * ]
 */
function transformToChartData(data: MarketDataItem[]): ChartDataRow[] {
  // 年月ごとにデータをグループ化
  const groupedByMonth = new Map<string, ChartDataRow>();

  for (const item of data) {
    const existing = groupedByMonth.get(item.yearMonth);
    if (existing) {
      existing[item.category] = item.value;
    } else {
      groupedByMonth.set(item.yearMonth, {
        yearMonth: item.yearMonth,
        [item.category]: item.value,
      });
    }
  }

  // 年月でソートして配列に変換
  return Array.from(groupedByMonth.values()).sort(
    (a, b) => a.yearMonth.localeCompare(b.yearMonth)
  );
}

/**
 * サマリーデータを計算
 */
export interface MarketDataSummary {
  totalCurrent: number;
  totalPrevious: number;
  growthRate: number;
  categoryCount: number;
}

function calculateSummary(
  chartData: ChartDataRow[],
  categories: AlcoholCategory[]
): MarketDataSummary {
  if (chartData.length < 2) {
    return {
      totalCurrent: 0,
      totalPrevious: 0,
      growthRate: 0,
      categoryCount: categories.length,
    };
  }

  const latestMonth = chartData[chartData.length - 1];
  const prevMonth = chartData[chartData.length - 2];

  const totalCurrent = categories.reduce(
    (sum, cat) => sum + (Number(latestMonth[cat]) || 0),
    0
  );
  const totalPrevious = categories.reduce(
    (sum, cat) => sum + (Number(prevMonth[cat]) || 0),
    0
  );

  const growthRate =
    totalPrevious > 0
      ? ((totalCurrent - totalPrevious) / totalPrevious) * 100
      : 0;

  return {
    totalCurrent,
    totalPrevious,
    growthRate: parseFloat(growthRate.toFixed(1)),
    categoryCount: categories.length,
  };
}

// ============================================================
// Hook
// ============================================================

/** Hook戻り値の拡張型 */
export interface UseMarketDataResult {
  chartData: ChartDataRow[];
  rawData: MarketDataItem[];
  summary: MarketDataSummary;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

/**
 * 市場データ取得Hook
 *
 * @example
 * ```tsx
 * const { chartData, summary, isLoading, refetch } = useMarketData({
 *   categories: [AlcoholCategory.CIDER, AlcoholCategory.WINE],
 *   from: '2024-01',
 *   to: '2024-12',
 * });
 *
 * if (isLoading) return <Loading />;
 *
 * return <ComparisonChart data={chartData} categories={categories} />;
 * ```
 */
export function useMarketData({
  categories,
  from,
  to,
  enabled = true,
}: UseMarketDataParams): UseMarketDataResult {
  const query: UseQueryResult<MarketDataApiResponse, Error> = useQuery({
    queryKey: ['marketData', categories.join(','), from, to],
    queryFn: () => fetchMarketData(categories, from, to),
    enabled: enabled && categories.length > 0 && !!from && !!to,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // データ変換
  const rawData = query.data?.data ?? [];
  const chartData = transformToChartData(rawData);
  const summary = calculateSummary(chartData, categories);

  return {
    chartData,
    rawData,
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export default useMarketData;
