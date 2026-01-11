import { create } from 'zustand';
import { AlcoholCategory, AnalysisView } from '@/types';

interface DashboardState {
  selectedView: AnalysisView;
  selectedCategories: AlcoholCategory[];
  dateRange: {
    from: string;
    to: string;
  };
  setSelectedView: (view: AnalysisView) => void;
  setSelectedCategories: (categories: AlcoholCategory[]) => void;
  setDateRange: (from: string, to: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedView: AnalysisView.MARKET_SHARE,
  selectedCategories: [AlcoholCategory.CIDER, AlcoholCategory.WINE],
  dateRange: {
    from: '2020-01',
    to: new Date().toISOString().slice(0, 7),
  },
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedCategories: (categories) => set({ selectedCategories: categories }),
  setDateRange: (from, to) => set({ dateRange: { from, to } }),
}));
