import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import MainLayout from '@/components/layout/MainLayout';
import QueryProvider from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: 'シードル市場分析ダッシュボード',
  description: 'シードル市場の分析とレポート作成',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AppRouterCacheProvider>
          <QueryProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <MainLayout>{children}</MainLayout>
            </ThemeProvider>
          </QueryProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
