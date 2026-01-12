'use client';

/**
 * TanStack Query Provider
 *
 * アプリケーション全体でReact Queryを使用するためのプロバイダー
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryClientProvider ラッパー
 *
 * Next.js App Routerでクライアントコンポーネントとして使用
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // 各リクエストで新しいQueryClientを作成（SSR対策）
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // デフォルトのキャッシュ時間: 5分
            staleTime: 5 * 60 * 1000,
            // エラー時のリトライ回数
            retry: 2,
            // ウィンドウフォーカス時の自動再取得を無効化
            refetchOnWindowFocus: false,
          },
          mutations: {
            // ミューテーションのリトライを無効化
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;
