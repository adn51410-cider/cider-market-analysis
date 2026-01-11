-- シードル市場分析ダッシュボード データベーススキーマ

-- market_data テーブル: 市場データ
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  year_month VARCHAR(7) NOT NULL, -- YYYY-MM形式
  value NUMERIC(12, 2) NOT NULL,
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('sales', 'volume', 'price')),
  source VARCHAR(20) NOT NULL CHECK (source IN ('estat', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, year_month, data_type)
);

-- api_cache テーブル: e-Stat APIキャッシュ
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  params JSONB NOT NULL,
  response JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_market_data_category ON market_data(category);
CREATE INDEX IF NOT EXISTS idx_market_data_year_month ON market_data(year_month);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);

-- サンプルデータ挿入（開発用）
INSERT INTO market_data (category, year_month, value, data_type, source) VALUES
  ('シードル', '2020-01', 10000, 'sales', 'estat'),
  ('シードル', '2020-02', 12000, 'sales', 'estat'),
  ('シードル', '2020-03', 15000, 'sales', 'estat'),
  ('シードル', '2020-04', 14000, 'sales', 'estat'),
  ('シードル', '2020-05', 18000, 'sales', 'estat'),
  ('シードル', '2020-06', 20000, 'sales', 'estat'),
  ('ワイン', '2020-01', 50000, 'sales', 'estat'),
  ('ワイン', '2020-02', 52000, 'sales', 'estat'),
  ('ワイン', '2020-03', 55000, 'sales', 'estat'),
  ('ワイン', '2020-04', 53000, 'sales', 'estat'),
  ('ワイン', '2020-05', 58000, 'sales', 'estat'),
  ('ワイン', '2020-06', 60000, 'sales', 'estat')
ON CONFLICT (category, year_month, data_type) DO NOTHING;

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
