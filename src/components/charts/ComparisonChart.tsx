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

// 数値フォーマット（カンマ区切り）
const formatNumber = (value: number): string => {
  return value.toLocaleString('ja-JP');
};

// カスタムツールチップ
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: 'white',
        border: '1px solid #558B2F',
        borderRadius: 1,
        p: 1.5,
        boxShadow: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        {label}
      </Typography>
      {payload.map((entry, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: entry.color }} />
          <Typography variant="body2">
            {entry.name}: <strong>{formatNumber(entry.value)}</strong> 円
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

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
              tickFormatter={formatNumber}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#558B2F' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              iconType="circle"
              iconSize={10}
            />
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
