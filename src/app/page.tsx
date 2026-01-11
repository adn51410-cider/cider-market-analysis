'use client';

import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import FilterPanel from '@/components/dashboard/FilterPanel';
import ComparisonChart from '@/components/charts/ComparisonChart';
import { useDashboardStore } from '@/stores/dashboardStore';
import { AlcoholCategory, AnalysisView } from '@/types';

// モックデータ（12ヶ月分）
const generateMockData = () => {
  const months = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  ];

  return months.map((yearMonth) => ({
    yearMonth,
    [AlcoholCategory.WINE]: Math.floor(500 + Math.random() * 200),
    [AlcoholCategory.SAKE]: Math.floor(400 + Math.random() * 150),
    [AlcoholCategory.CIDER]: Math.floor(50 + Math.random() * 30),
    [AlcoholCategory.BEER]: Math.floor(800 + Math.random() * 300),
    [AlcoholCategory.SHOCHU]: Math.floor(300 + Math.random() * 100),
    [AlcoholCategory.WHISKEY]: Math.floor(200 + Math.random() * 80),
    [AlcoholCategory.OTHER]: Math.floor(100 + Math.random() * 50),
  }));
};

const MOCK_DATA = generateMockData();

// 分析視点ごとのタイトル
const VIEW_TITLES: Record<AnalysisView, string> = {
  [AnalysisView.MARKET_SHARE]: '市場規模推移',
  [AnalysisView.GROWTH_TREND]: '成長率トレンド',
  [AnalysisView.PRICE_ANALYSIS]: '平均価格推移',
  [AnalysisView.SEASONAL_PATTERN]: '季節性パターン',
  [AnalysisView.DEMOGRAPHIC]: '消費者属性別購入金額',
  [AnalysisView.REGIONAL]: '地域別消費動向',
};

// サマリーカード用のデータ
const getSummaryData = (categories: AlcoholCategory[]) => {
  const latestMonth = MOCK_DATA[MOCK_DATA.length - 1];
  const prevMonth = MOCK_DATA[MOCK_DATA.length - 2];

  const totalCurrent = categories.reduce(
    (sum, cat) => sum + (latestMonth[cat] as number || 0),
    0
  );
  const totalPrev = categories.reduce(
    (sum, cat) => sum + (prevMonth[cat] as number || 0),
    0
  );
  const growthRate = ((totalCurrent - totalPrev) / totalPrev * 100).toFixed(1);

  return {
    totalMarket: totalCurrent,
    growthRate: parseFloat(growthRate),
    categoryCount: categories.length,
  };
};

export default function Home() {
  const { selectedView, selectedCategories } = useDashboardStore();
  const summary = getSummaryData(selectedCategories);

  return (
    <Box>
      {/* ページタイトル */}
      <Typography variant="h4" component="h1" gutterBottom color="primary" fontWeight="bold">
        市場分析ダッシュボード
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        シードルと他の酒類市場を6つの視点で比較分析
      </Typography>

      {/* フィルターパネル */}
      <FilterPanel />

      {/* サマリーカード */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShowChartIcon />
                <Typography variant="subtitle2">選択カテゴリー合計</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {summary.totalMarket.toLocaleString()}
              </Typography>
              <Typography variant="caption">百万円（直近月）</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: summary.growthRate >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon />
                <Typography variant="subtitle2">前月比成長率</Typography>
              </Box>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {summary.growthRate >= 0 ? '+' : ''}{summary.growthRate}%
              </Typography>
              <Typography variant="caption">月次成長率</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
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
        </Grid>
      </Grid>

      {/* メイングラフ */}
      <ComparisonChart
        title={VIEW_TITLES[selectedView]}
        data={MOCK_DATA}
        categories={selectedCategories}
        yAxisLabel="金額（百万円）"
      />

      {/* 補足情報 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          データソース: e-Stat API（家計調査）、国税庁（酒税課税状況表）
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ※ 現在はモックデータを表示しています。実際のAPIデータは後続フェーズで統合されます。
        </Typography>
      </Box>
    </Box>
  );
}
