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
} from '@mui/material';
import { AlcoholCategory, AnalysisView } from '@/types';
import { useDashboardStore } from '@/stores/dashboardStore';

const ANALYSIS_VIEWS = Object.values(AnalysisView);
const CATEGORIES = Object.values(AlcoholCategory);

export default function FilterPanel() {
  const { selectedView, selectedCategories, setSelectedView, setSelectedCategories } =
    useDashboardStore();

  const handleViewChange = (event: SelectChangeEvent) => {
    setSelectedView(event.target.value as AnalysisView);
  };

  const handleCategoryChange = (event: SelectChangeEvent<typeof selectedCategories>) => {
    const value = event.target.value;
    setSelectedCategories(
      typeof value === 'string' ? value.split(',') as AlcoholCategory[] : value
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel>分析視点</InputLabel>
        <Select value={selectedView} label="分析視点" onChange={handleViewChange}>
          {ANALYSIS_VIEWS.map((view) => (
            <MenuItem key={view} value={view}>
              {view}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 300 }}>
        <InputLabel>酒類カテゴリー</InputLabel>
        <Select
          multiple
          value={selectedCategories}
          onChange={handleCategoryChange}
          input={<OutlinedInput label="酒類カテゴリー" />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map((value) => (
                <Chip key={value} label={value} size="small" />
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
    </Box>
  );
}
