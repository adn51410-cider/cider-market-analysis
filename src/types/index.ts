// 酒類カテゴリー
export enum AlcoholCategory {
  WINE = 'ワイン',
  SAKE = '日本酒',
  BEER = 'ビール',
  SHOCHU = '焼酎',
  WHISKEY = 'ウイスキー',
  CIDER = 'シードル',
  OTHER = 'その他',
}

// 分析視点
export enum AnalysisView {
  MARKET_SHARE = '市場シェア分析',
  GROWTH_TREND = '成長トレンド分析',
  PRICE_ANALYSIS = '価格帯分析',
  SEASONAL_PATTERN = '季節性分析',
  DEMOGRAPHIC = '消費者属性分析',
  REGIONAL = '地域別分析',
}

// 市場データエンティティ
export interface MarketData {
  id: string;
  category: AlcoholCategory;
  yearMonth: string; // YYYY-MM形式
  value: number;
  dataType: 'sales' | 'volume' | 'price';
  source: 'estat' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

// e-Stat APIキャッシュ
export interface ApiCache {
  id: string;
  cacheKey: string;
  endpoint: string;
  params: Record<string, any>;
  response: any;
  expiresAt: Date;
  createdAt: Date;
}

// グラフ設定
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie';
  title: string;
  dataKey: string;
  color?: string;
}

// レポート設定
export interface ReportConfig {
  title: string;
  dateRange: {
    from: string;
    to: string;
  };
  categories: AlcoholCategory[];
  charts: ChartConfig[];
}
