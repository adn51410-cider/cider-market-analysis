import { Box, Container, Typography } from '@mui/material';

export default function ReportPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          レポート出力
        </Typography>
        <Typography variant="body1" color="text.secondary">
          P-002: PDFレポート生成機能（開発中）
        </Typography>
      </Box>
    </Container>
  );
}
