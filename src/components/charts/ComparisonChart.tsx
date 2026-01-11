'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';
import { AlcoholCategory } from '@/types';

// カテゴリー別のカラー設定（ワイン・日本酒を強調）
const CATEGORY_COLORS: Record<string, string> = {
  [AlcoholCategory.WINE]: '#558B2F',      // Primary（強調）
  [AlcoholCategory.SAKE]: '#FFC107',      // Secondary（強調）
  [AlcoholCategory.CIDER]: '#7CB342',     // Primary Light
  [AlcoholCategory.BEER]: '#9E9E9E',      // グレー
  [AlcoholCategory.SHOCHU]: '#757575',    // ダークグレー
  [AlcoholCategory.WHISKEY]: '#BDBDBD',   // ライトグレー
  [AlcoholCategory.OTHER]: '#E0E0E0',     // 薄いグレー
};

interface ChartDataPoint {
  yearMonth: string;
  [key: string]: string | number;
}

interface ComparisonChartProps {
  title: string;
  data: ChartDataPoint[];
  categories: AlcoholCategory[];
  yAxisLabel?: string;
}

export default function ComparisonChart({
  title,
  data,
  categories,
  yAxisLabel = '金額（百万円）',
}: ComparisonChartProps) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom color="primary">
        {title}
      </Typography>
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" />
            <XAxis
              dataKey="yearMonth"
              tick={{ fontSize: 12 }}
              stroke="#558B2F"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#558B2F"
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#558B2F' },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #558B2F',
                borderRadius: 8,
              }}
            />
            <Legend />
            {categories.map((category) => (
              <Line
                key={category}
                type="monotone"
                dataKey={category}
                stroke={CATEGORY_COLORS[category] || '#999999'}
                strokeWidth={
                  category === AlcoholCategory.WINE || category === AlcoholCategory.SAKE
                    ? 3
                    : 2
                }
                dot={{
                  fill: CATEGORY_COLORS[category] || '#999999',
                  strokeWidth: 2,
                }}
                activeDot={{ r: 8 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}
