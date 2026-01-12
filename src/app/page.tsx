'use client';

import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Skeleton,
  LinearProgress,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import FilterPanel from '@/components/dashboard/FilterPanel';
import ComparisonChart from '@/components/charts/ComparisonChart';
import { useDashboardStore } from '@/stores/dashboardStore';
import { AnalysisView } from '@/types';
import { useMarketData } from '@/hooks/queries';

// 分析視点ごとのタイトル
const VIEW_TITLES: Record<AnalysisView, string> = {
  [AnalysisView.MARKET_SHARE]: '市場規模推移',
  [AnalysisView.GROWTH_TREND]: '成長率トレンド',
  [AnalysisView.PRICE_ANALYSIS]: '平均価格推移',
  [AnalysisView.SEASONAL_PATTERN]: '季節性パターン',
  [AnalysisView.DEMOGRAPHIC]: '消費者属性別購入金額',
  [AnalysisView.REGIONAL]: '地域別消費動向',
};

/**
 * サマリーカードのスケルトン
 */
function SummaryCardSkeleton() {
  return (
    <Card sx={{ bgcolor: 'grey.300' }}>
      <CardContent>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" height={40} />
        <Skeleton variant="text" width="30%" />
      </CardContent>
    </Card>
  );
}

/**
 * グラフのスケルトン
 */
function ChartSkeleton() {
  return (
    <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Skeleton variant="text" width="30%" height={32} />
      <Skeleton variant="rectangular" height={350} sx={{ mt: 2 }} />
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function, complexity
export default function Home() {
  const { selectedView, selectedCategories, dateRange } = useDashboardStore();

  // APIからデータ取得
  const { chartData, summary, isLoading, isError, error, isFetching, refetch } =
    useMarketData({
      categories: selectedCategories,
      from: dateRange.from,
      to: dateRange.to,
    });

  return (
    <Box>
      {/* ページタイトル */}
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        color="primary"
        fontWeight="bold"
      >
        市場分析ダッシュボード
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        シードルと他の酒類市場を6つの視点で比較分析
      </Typography>

      {/* フィルターパネル */}
      <FilterPanel onRefresh={refetch} isRefreshing={isFetching} />

      {/* ローディングプログレス */}
      {isFetching && !isLoading && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      )}

      {/* エラー表示 */}
      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          データの取得に失敗しました: {error?.message || '不明なエラー'}
        </Alert>
      )}

      {/* サマリーカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <SummaryCardSkeleton />
          ) : (
            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShowChartIcon />
                  <Typography variant="subtitle2">
                    選択カテゴリー合計
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {summary.totalCurrent.toLocaleString()}
                </Typography>
                <Typography variant="caption">百万円（直近月）</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <SummaryCardSkeleton />
          ) : (
            <Card
              sx={{
                bgcolor:
                  summary.growthRate >= 0 ? 'success.main' : 'error.main',
                color: 'white',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon />
                  <Typography variant="subtitle2">前月比成長率</Typography>
                </Box>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {summary.growthRate >= 0 ? '+' : ''}
                  {summary.growthRate}%
                </Typography>
                <Typography variant="caption">月次成長率</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          {isLoading ? (
            <SummaryCardSkeleton />
          ) : (
            <Card sx={{ bgcolor: 'secondary.main', color: 'black' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PieChartIcon />
                  <Typography variant="subtitle2">分析対象</Typography>
                </Box>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {summary.categoryCount}
                </Typography>
                <Typography variant="caption">カテゴリー</Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* メイングラフ */}
      {isLoading ? (
        <ChartSkeleton />
      ) : chartData.length > 0 ? (
        <ComparisonChart
          title={VIEW_TITLES[selectedView]}
          data={chartData}
          categories={selectedCategories}
          yAxisLabel="金額（百万円）"
        />
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          選択した条件に該当するデータがありません。期間やカテゴリーを変更してください。
        </Alert>
      )}

      {/* 補足情報 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          データソース: e-Stat API（家計調査）、国税庁（酒税課税状況表）
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ※ データは5分間キャッシュされます。最新データを取得するには「更新」ボタンをクリックしてください。
        </Typography>
      </Box>
    </Box>
  );
}
