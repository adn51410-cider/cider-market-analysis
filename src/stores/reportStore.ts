import { create } from 'zustand';
import { AlcoholCategory, AnalysisView } from '@/types';

interface ReportState {
  title: string;
  comment: string;
  selectedCharts: AnalysisView[];
  categories: AlcoholCategory[];
  dateRange: {
    from: string;
    to: string;
  };
  setTitle: (title: string) => void;
  setComment: (comment: string) => void;
  setSelectedCharts: (charts: AnalysisView[]) => void;
  setCategories: (categories: AlcoholCategory[]) => void;
  setDateRange: (from: string, to: string) => void;
  resetReport: () => void;
}

const initialState = {
  title: 'シードル市場分析レポート',
  comment: '',
  selectedCharts: [AnalysisView.MARKET_SHARE, AnalysisView.GROWTH_TREND],
  categories: [AlcoholCategory.CIDER, AlcoholCategory.WINE, AlcoholCategory.SAKE],
  dateRange: {
    from: '2024-01',
    to: new Date().toISOString().slice(0, 7),
  },
};

export const useReportStore = create<ReportState>((set) => ({
  ...initialState,
  setTitle: (title) => set({ title }),
  setComment: (comment) => set({ comment }),
  setSelectedCharts: (selectedCharts) => set({ selectedCharts }),
  setCategories: (categories) => set({ categories }),
  setDateRange: (from, to) => set({ dateRange: { from, to } }),
  resetReport: () => set(initialState),
}));
