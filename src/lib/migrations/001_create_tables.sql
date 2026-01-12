-- Migration: 001_create_tables
-- Description: Create market_data and api_cache tables with indexes
-- Created: 2026-01-11

-- ========================================
-- market_data table
-- ========================================
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,           -- 酒類カテゴリー
  year_month VARCHAR(7) NOT NULL,          -- YYYY-MM形式
  value DECIMAL(15,2) NOT NULL,            -- 金額・数量
  data_type VARCHAR(20) NOT NULL,          -- sales/volume/price
  source VARCHAR(20) NOT NULL DEFAULT 'estat', -- estat/manual
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, year_month, data_type)  -- 重複防止
);

-- Indexes for market_data
CREATE INDEX IF NOT EXISTS idx_market_data_category ON market_data(category);
CREATE INDEX IF NOT EXISTS idx_market_data_year_month ON market_data(year_month);
CREATE INDEX IF NOT EXISTS idx_market_data_lookup ON market_data(category, year_month);

-- ========================================
-- api_cache table
-- ========================================
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL UNIQUE,  -- パラメータハッシュ
  endpoint VARCHAR(255) NOT NULL,          -- APIエンドポイント
  params JSONB NOT NULL,                   -- リクエストパラメータ
  response JSONB NOT NULL,                 -- レスポンスJSON
  expires_at TIMESTAMP NOT NULL,           -- 有効期限
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for api_cache
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);

-- ========================================
-- updated_at trigger function
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for market_data updated_at
DROP TRIGGER IF EXISTS update_market_data_updated_at ON market_data;
CREATE TRIGGER update_market_data_updated_at
  BEFORE UPDATE ON market_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
