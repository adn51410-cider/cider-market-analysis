import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // ワイン用
    },
    secondary: {
      main: '#dc004e', // 日本酒用
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
  },
});
