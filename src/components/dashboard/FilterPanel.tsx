'use client';

import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  TextField,
  Button,
  Paper,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useRouter } from 'next/navigation';
import { AlcoholCategory, AnalysisView } from '@/types';
import { useDashboardStore } from '@/stores/dashboardStore';

const ANALYSIS_VIEWS = Object.values(AnalysisView);
const CATEGORIES = Object.values(AlcoholCategory);

interface FilterPanelProps {
  /** データ更新コールバック */
  onRefresh?: () => void;
  /** 更新中フラグ */
  isRefreshing?: boolean;
}

// eslint-disable-next-line max-lines-per-function
export default function FilterPanel({
  onRefresh,
  isRefreshing = false,
}: FilterPanelProps) {
  const router = useRouter();
  const {
    selectedView,
    selectedCategories,
    dateRange,
    setSelectedView,
    setSelectedCategories,
    setDateRange,
  } = useDashboardStore();

  const handleViewChange = (event: SelectChangeEvent) => {
    setSelectedView(event.target.value as AnalysisView);
  };

  const handleCategoryChange = (
    event: SelectChangeEvent<typeof selectedCategories>
  ) => {
    const value = event.target.value;
    setSelectedCategories(
      typeof value === 'string'
        ? (value.split(',') as AlcoholCategory[])
        : value
    );
  };

  const handleFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(event.target.value, dateRange.to);
  };

  const handleToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange(dateRange.from, event.target.value);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleReportClick = () => {
    router.push('/report');
  };

  const handleImportClick = () => {
    router.push('/report?tab=import');
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}
      >
        {/* 分析視点 */}
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>分析視点</InputLabel>
          <Select
            value={selectedView}
            label="分析視点"
            onChange={handleViewChange}
          >
            {ANALYSIS_VIEWS.map((view) => (
              <MenuItem key={view} value={view}>
                {view}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 酒類カテゴリー */}
        <FormControl sx={{ minWidth: 280 }} size="small">
          <InputLabel>酒類カテゴリー</InputLabel>
          <Select
            multiple
            value={selectedCategories}
            onChange={handleCategoryChange}
            input={<OutlinedInput label="酒類カテゴリー" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" color="primary" />
                ))}
              </Box>
            )}
          >
            {CATEGORIES.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 期間選択 */}
        <TextField
          label="開始年月"
          type="month"
          value={dateRange.from}
          onChange={handleFromChange}
          size="small"
          sx={{ width: 160 }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="終了年月"
          type="month"
          value={dateRange.to}
          onChange={handleToChange}
          size="small"
          sx={{ width: 160 }}
          InputLabelProps={{ shrink: true }}
        />

        {/* アクションボタン */}
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Button
            variant="outlined"
            startIcon={
              isRefreshing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={handleRefresh}
            size="small"
            disabled={isRefreshing}
          >
            {isRefreshing ? '更新中...' : '更新'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={handleImportClick}
            size="small"
            color="secondary"
          >
            CSVインポート
          </Button>
          <Button
            variant="contained"
            startIcon={<DescriptionIcon />}
            onClick={handleReportClick}
            size="small"
          >
            レポート出力
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
