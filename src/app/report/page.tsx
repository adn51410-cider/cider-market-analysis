'use client';

import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PreviewIcon from '@mui/icons-material/Preview';
import { useRouter } from 'next/navigation';
import { useReportStore } from '@/stores/reportStore';
import { AnalysisView, AlcoholCategory } from '@/types';
import ComparisonChart from '@/components/charts/ComparisonChart';

// 分析視点の一覧
const ANALYSIS_VIEWS = Object.values(AnalysisView);
const VIEW_LABELS: Record<AnalysisView, string> = {
  [AnalysisView.MARKET_SHARE]: '市場規模推移',
  [AnalysisView.GROWTH_TREND]: '成長率トレンド',
  [AnalysisView.PRICE_ANALYSIS]: '平均価格推移',
  [AnalysisView.SEASONAL_PATTERN]: '季節性パターン',
  [AnalysisView.DEMOGRAPHIC]: '消費者属性別購入金額',
  [AnalysisView.REGIONAL]: '地域別消費動向',
};

// モックデータ生成
const generateMockData = () => {
  const months = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  ];

  return months.map((yearMonth) => ({
    yearMonth,
    [AlcoholCategory.WINE]: Math.floor(500 + Math.random() * 200),
    [AlcoholCategory.SAKE]: Math.floor(400 + Math.random() * 150),
    [AlcoholCategory.CIDER]: Math.floor(50 + Math.random() * 30),
    [AlcoholCategory.BEER]: Math.floor(800 + Math.random() * 300),
    [AlcoholCategory.SHOCHU]: Math.floor(300 + Math.random() * 100),
    [AlcoholCategory.WHISKEY]: Math.floor(200 + Math.random() * 80),
    [AlcoholCategory.OTHER]: Math.floor(100 + Math.random() * 50),
  }));
};

const MOCK_DATA = generateMockData();

export default function ReportPage() {
  const router = useRouter();
  const chartRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    title,
    comment,
    selectedCharts,
    categories,
    dateRange,
    setTitle,
    setComment,
    setSelectedCharts,
  } = useReportStore();

  const handleChartToggle = (view: AnalysisView) => {
    if (selectedCharts.includes(view)) {
      setSelectedCharts(selectedCharts.filter((v) => v !== view));
    } else {
      if (selectedCharts.length < 10) {
        setSelectedCharts([...selectedCharts, view]);
      }
    }
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);

    // PDF生成処理（実際の実装は後続フェーズ）
    // html2canvas + @react-pdf/renderer を使用
    await new Promise((resolve) => setTimeout(resolve, 2000));

    alert('PDF生成機能は後続フェーズで実装予定です。\n選択されたグラフ: ' + selectedCharts.length + '件');
    setIsGenerating(false);
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <Box>
      {/* ページタイトル */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          size="small"
        >
          ダッシュボードに戻る
        </Button>
        <Typography variant="h4" component="h1" color="primary" fontWeight="bold">
          レポート出力
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 左側：設定パネル */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              レポート設定
            </Typography>

            {/* タイトル */}
            <TextField
              fullWidth
              label="レポートタイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ mb: 2 }}
              required
            />

            {/* 期間表示 */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                対象期間
              </Typography>
              <Typography variant="body1">
                {dateRange.from} 〜 {dateRange.to}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* グラフ選択 */}
            <Typography variant="subtitle1" gutterBottom>
              含めるグラフ（最大10件）
            </Typography>
            <FormGroup>
              {ANALYSIS_VIEWS.map((view) => (
                <FormControlLabel
                  key={view}
                  control={
                    <Checkbox
                      checked={selectedCharts.includes(view)}
                      onChange={() => handleChartToggle(view)}
                      disabled={
                        !selectedCharts.includes(view) && selectedCharts.length >= 10
                      }
                    />
                  }
                  label={VIEW_LABELS[view]}
                />
              ))}
            </FormGroup>

            <Divider sx={{ my: 2 }} />

            {/* コメント */}
            <TextField
              fullWidth
              label="コメント（任意）"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              multiline
              rows={4}
              placeholder="レポートに追加するコメントを入力..."
              sx={{ mb: 2 }}
            />

            {/* アクションボタン */}
            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => setShowPreview(!showPreview)}
                fullWidth
              >
                {showPreview ? 'プレビューを閉じる' : 'プレビュー表示'}
              </Button>
              <Button
                variant="contained"
                startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdfIcon />}
                onClick={handleGeneratePdf}
                disabled={isGenerating || selectedCharts.length === 0 || !title}
                fullWidth
              >
                {isGenerating ? '生成中...' : 'PDF出力'}
              </Button>
            </Box>

            {selectedCharts.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                少なくとも1つのグラフを選択してください
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* 右側：プレビュー */}
        <Grid item xs={12} md={8}>
          {showPreview ? (
            <Paper sx={{ p: 3 }} ref={chartRef}>
              <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                作成日: {new Date().toLocaleDateString('ja-JP')} | 対象期間: {dateRange.from} 〜 {dateRange.to}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* 選択されたグラフを表示 */}
              {selectedCharts.map((view) => (
                <Box key={view} sx={{ mb: 4 }}>
                  <ComparisonChart
                    title={VIEW_LABELS[view]}
                    data={MOCK_DATA}
                    categories={categories}
                    yAxisLabel="金額（百万円）"
                  />
                </Box>
              ))}

              {/* コメント */}
              {comment && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle1" gutterBottom color="primary">
                    コメント
                  </Typography>
                  <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                    {comment}
                  </Typography>
                </Box>
              )}
            </Paper>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <PreviewIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                プレビューを表示するには
              </Typography>
              <Typography variant="body2" color="text.secondary">
                左側の「プレビュー表示」ボタンをクリックしてください
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* 補足情報 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          PDF生成仕様: A4サイズ、1ページ1グラフ、フォント: メイリオ
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ※ PDF生成機能は後続フェーズで html2canvas + @react-pdf/renderer を使用して実装されます。
        </Typography>
      </Box>
    </Box>
  );
}
