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
    // e-Stat家計調査データは1985年〜2025年11月まで利用可能（2025年改定版）
    from: '2020-01',
    to: '2025-11',
  },
  setSelectedView: (view) => set({ selectedView: view }),
  setSelectedCategories: (categories) => set({ selectedCategories: categories }),
  setDateRange: (from, to) => set({ dateRange: { from, to } }),
}));
