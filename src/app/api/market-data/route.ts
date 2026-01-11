import { NextRequest, NextResponse } from 'next/server';
import { AlcoholCategory } from '@/types';

interface MockDataItem {
  yearMonth: string;
  value: number;
  category: string;
  dataType: string;
}

// モックデータ（開発用）
const MOCK_DATA: Record<string, MockDataItem[]> = {
  'シードル': [
    { yearMonth: '2020-01', value: 10000, category: 'シードル', dataType: 'sales' },
    { yearMonth: '2020-02', value: 12000, category: 'シードル', dataType: 'sales' },
    { yearMonth: '2020-03', value: 15000, category: 'シードル', dataType: 'sales' },
    { yearMonth: '2020-04', value: 14000, category: 'シードル', dataType: 'sales' },
    { yearMonth: '2020-05', value: 18000, category: 'シードル', dataType: 'sales' },
    { yearMonth: '2020-06', value: 20000, category: 'シードル', dataType: 'sales' },
  ],
  'ワイン': [
    { yearMonth: '2020-01', value: 50000, category: 'ワイン', dataType: 'sales' },
    { yearMonth: '2020-02', value: 52000, category: 'ワイン', dataType: 'sales' },
    { yearMonth: '2020-03', value: 55000, category: 'ワイン', dataType: 'sales' },
    { yearMonth: '2020-04', value: 53000, category: 'ワイン', dataType: 'sales' },
    { yearMonth: '2020-05', value: 58000, category: 'ワイン', dataType: 'sales' },
    { yearMonth: '2020-06', value: 60000, category: 'ワイン', dataType: 'sales' },
  ],
  '日本酒': [
    { yearMonth: '2020-01', value: 40000, category: '日本酒', dataType: 'sales' },
    { yearMonth: '2020-02', value: 42000, category: '日本酒', dataType: 'sales' },
    { yearMonth: '2020-03', value: 45000, category: '日本酒', dataType: 'sales' },
    { yearMonth: '2020-04', value: 43000, category: '日本酒', dataType: 'sales' },
    { yearMonth: '2020-05', value: 48000, category: '日本酒', dataType: 'sales' },
    { yearMonth: '2020-06', value: 50000, category: '日本酒', dataType: 'sales' },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // バリデーション
    if (!category || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: category, from, to' },
        { status: 400 }
      );
    }

    // カテゴリーの検証
    if (!Object.values(AlcoholCategory).includes(category as AlcoholCategory)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // モックデータを返す（データベース接続前の開発用）
    const data = MOCK_DATA[category] || [];
    const filteredData = data.filter(
      (item) => item.yearMonth >= from && item.yearMonth <= to
    );

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
