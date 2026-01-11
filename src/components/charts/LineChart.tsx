'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Typography } from '@mui/material';

interface ChartDataPoint {
  yearMonth: string;
  value: number;
  [key: string]: string | number;
}

interface LineChartProps {
  title: string;
  data: ChartDataPoint[];
  dataKey: string;
  xAxisKey?: string;
  color?: string;
}

export default function LineChart({
  title,
  data,
  dataKey,
  xAxisKey = 'yearMonth',
  color = '#1976d2',
}: LineChartProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={400}>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
