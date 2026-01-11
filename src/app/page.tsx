import { Box, Container, Typography } from '@mui/material';
import FilterPanel from '@/components/dashboard/FilterPanel';
import LineChart from '@/components/charts/LineChart';

// サンプルデータ
const sampleData = [
  { yearMonth: '2020-01', value: 100 },
  { yearMonth: '2020-02', value: 120 },
  { yearMonth: '2020-03', value: 150 },
  { yearMonth: '2020-04', value: 140 },
  { yearMonth: '2020-05', value: 180 },
  { yearMonth: '2020-06', value: 200 },
];

export default function Home() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          市場分析ダッシュボード
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          P-001: シードル市場分析ダッシュボード
        </Typography>

        <FilterPanel />

        <LineChart
          title="市場トレンド（サンプルデータ）"
          data={sampleData}
          dataKey="value"
        />
      </Box>
    </Container>
  );
}
