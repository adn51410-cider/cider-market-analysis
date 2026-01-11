import { AlcoholCategory, MarketData } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3247';

export const api = {
  async getMarketData(
    category: AlcoholCategory,
    from: string,
    to: string
  ): Promise<MarketData[]> {
    const params = new URLSearchParams({
      category,
      from,
      to,
    });

    const response = await fetch(`${API_BASE_URL}/api/market-data?${params}`);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/api/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  },
};
