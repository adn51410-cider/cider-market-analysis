'use client';

import { createTheme } from '@mui/material/styles';

// テーマ3: ナチュラルシードル
// コンセプト: 自然・フレッシュ
// シードル・果実酒のブランディングに最適な配色

export const theme = createTheme({
  palette: {
    primary: {
      main: '#558B2F', // フォレストグリーン
      light: '#7CB342',
      dark: '#33691E',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#FFC107', // ゴールド（アクセント）
      light: '#FFD54F',
      dark: '#FFA000',
      contrastText: '#000000',
    },
    background: {
      default: '#F1F8E9', // ライトグリーン背景
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1B5E20',
      secondary: '#558B2F',
    },
    error: {
      main: '#D32F2F',
    },
    warning: {
      main: '#F57C00',
    },
    success: {
      main: '#388E3C',
    },
    info: {
      main: '#1976D2',
    },
  },
  typography: {
    fontFamily: [
      'Meiryo',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(85, 139, 47, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(85, 139, 47, 0.12)',
        },
      },
    },
  },
});
