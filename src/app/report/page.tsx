'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Snackbar,
  Tabs,
  Tab,
  Skeleton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PreviewIcon from '@mui/icons-material/Preview';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useRouter } from 'next/navigation';
import { useReportStore } from '@/stores/reportStore';
import { AnalysisView } from '@/types';
import ComparisonChart from '@/components/charts/ComparisonChart';
import CsvImportPanel from '@/components/dashboard/CsvImportPanel';
import { captureElement } from '@/utils/chartCapture';
import {
  generateReportPdfFromImages,
  generateDefaultFilename,
} from '@/utils/pdfExport';
import { ChartImage } from '@/components/pdf/ReportDocument';
import { useMarketData } from '@/hooks/queries';

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

// タブパネル
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

// チャートをキャプチャしてPDFを生成
async function captureChartsAndGeneratePdf(
  selectedCharts: AnalysisView[],
  chartRefs: Map<string, HTMLDivElement>,
  reportConfig: {
    title: string;
    dateFrom: string;
    dateTo: string;
    comment?: string;
  },
  onProgress: (message: string) => void
): Promise<number> {
  const charts: ChartImage[] = [];
  const totalCharts = selectedCharts.length;

  for (let i = 0; i < selectedCharts.length; i++) {
    const view = selectedCharts[i];
    const chartElement = chartRefs.get(view);

    onProgress(`グラフをキャプチャ中... (${i + 1}/${totalCharts})`);

    if (chartElement) {
      const result = await captureElement(chartElement, {
        scale: 2,
        backgroundColor: '#FFFFFF',
        format: 'png',
      });

      charts.push({
        title: VIEW_LABELS[view],
        dataUrl: result.dataUrl,
      });
    }
  }

  if (charts.length === 0) {
    throw new Error(
      'キャプチャ可能なグラフがありません。プレビューを表示してから再度お試しください。'
    );
  }

  onProgress('PDFを生成中...');

  await generateReportPdfFromImages(charts, reportConfig, {
    filename: generateDefaultFilename(),
  });

  return charts.length;
}

/**
 * URLパラメータを読み取るコンポーネント
 */
function SearchParamsReader({
  onTabChange,
}: {
  onTabChange: (tab: number) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'import') {
      onTabChange(1);
    }
  }, [searchParams, onTabChange]);

  return null;
}

// eslint-disable-next-line max-lines-per-function, complexity
function ReportPageContent() {
  const router = useRouter();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

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

  // APIからデータ取得
  const { chartData, isLoading: isDataLoading } = useMarketData({
    categories,
    from: dateRange.from,
    to: dateRange.to,
  });

  // グラフ要素のRefを設定
  const setChartRef = useCallback(
    (view: AnalysisView, element: HTMLDivElement | null) => {
      if (element) {
        chartRefs.current.set(view, element);
      } else {
        chartRefs.current.delete(view);
      }
    },
    []
  );

  const handleChartToggle = (view: AnalysisView) => {
    const isSelected = selectedCharts.includes(view);
    if (isSelected) {
      setSelectedCharts(selectedCharts.filter((v) => v !== view));
    } else if (selectedCharts.length < 10) {
      setSelectedCharts([...selectedCharts, view]);
    }
  };

  const handleGeneratePdf = async () => {
    if (!showPreview) {
      setShowPreview(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsGenerating(true);
    setError(null);

    try {
      const chartCount = await captureChartsAndGeneratePdf(
        selectedCharts,
        chartRefs.current,
        {
          title,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          comment: comment || undefined,
        },
        setProgress
      );
      setSuccessMessage(`PDFを生成しました（${chartCount}グラフ）`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'PDF生成中にエラーが発生しました'
      );
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleBack = () => router.push('/');
  const handleCloseSnackbar = () => setSuccessMessage(null);
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSearchParamsTabChange = useCallback((tab: number) => {
    setTabValue(tab);
  }, []);

  const isPdfButtonDisabled =
    isGenerating || selectedCharts.length === 0 || !title || isDataLoading;
  const pdfButtonLabel = isGenerating ? progress || '生成中...' : 'PDF出力';

  return (
    <Box>
      {/* URLパラメータを読み取る */}
      <Suspense fallback={null}>
        <SearchParamsReader onTabChange={handleSearchParamsTabChange} />
      </Suspense>

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
        <Typography
          variant="h4"
          component="h1"
          color="primary"
          fontWeight="bold"
        >
          レポート・データ管理
        </Typography>
      </Box>

      {/* タブ */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab
            icon={<PictureAsPdfIcon />}
            iconPosition="start"
            label="レポート出力"
          />
          <Tab
            icon={<UploadFileIcon />}
            iconPosition="start"
            label="CSVインポート"
          />
        </Tabs>
      </Paper>

      {/* レポート出力タブ */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* 左側：設定パネル */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                レポート設定
              </Typography>

              <TextField
                fullWidth
                label="レポートタイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={{ mb: 2 }}
                required
              />

              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  対象期間
                </Typography>
                <Typography variant="body1">
                  {dateRange.from} ~ {dateRange.to}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

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
                          !selectedCharts.includes(view) &&
                          selectedCharts.length >= 10
                        }
                      />
                    }
                    label={VIEW_LABELS[view]}
                  />
                ))}
              </FormGroup>

              <Divider sx={{ my: 2 }} />

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

              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={() => setShowPreview(!showPreview)}
                  fullWidth
                  disabled={isDataLoading}
                >
                  {showPreview ? 'プレビューを閉じる' : 'プレビュー表示'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    isGenerating ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <PictureAsPdfIcon />
                    )
                  }
                  onClick={handleGeneratePdf}
                  disabled={isPdfButtonDisabled}
                  fullWidth
                >
                  {pdfButtonLabel}
                </Button>
              </Box>

              {selectedCharts.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  少なくとも1つのグラフを選択してください
                </Alert>
              )}
              {error && (
                <Alert
                  severity="error"
                  sx={{ mt: 2 }}
                  onClose={() => setError(null)}
                >
                  {error}
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* 右側：プレビュー */}
          <Grid item xs={12} md={8}>
            {showPreview ? (
              <Paper sx={{ p: 3 }} ref={chartContainerRef}>
                <Typography
                  variant="h5"
                  gutterBottom
                  color="primary"
                  fontWeight="bold"
                >
                  {title}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  作成日: {new Date().toLocaleDateString('ja-JP')} | 対象期間:{' '}
                  {dateRange.from} ~ {dateRange.to}
                </Typography>
                <Divider sx={{ my: 2 }} />

                {isDataLoading ? (
                  <Box>
                    {selectedCharts.map((view) => (
                      <Box key={view} sx={{ mb: 4 }}>
                        <Skeleton variant="text" width="30%" height={32} />
                        <Skeleton
                          variant="rectangular"
                          height={300}
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : chartData.length > 0 ? (
                  selectedCharts.map((view) => (
                    <Box
                      key={view}
                      sx={{ mb: 4 }}
                      ref={(el: HTMLDivElement | null) => setChartRef(view, el)}
                    >
                      <ComparisonChart
                        title={VIEW_LABELS[view]}
                        data={chartData}
                        categories={categories}
                        yAxisLabel="金額（百万円）"
                      />
                    </Box>
                  ))
                ) : (
                  <Alert severity="info">
                    選択した条件に該当するデータがありません。
                  </Alert>
                )}

                {comment && (
                  <Box
                    sx={{
                      mt: 3,
                      p: 2,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      コメント
                    </Typography>
                    <Typography
                      variant="body1"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {comment}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ) : (
              <Paper
                sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}
              >
                <PreviewIcon
                  sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
                />
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

        <Box
          sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            PDF生成仕様: A4サイズ、1ページ1グラフ、フォント: Noto Sans
            JP（日本語対応）
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ※
            グラフは2x解像度でキャプチャされ、高品質なPDFが生成されます。最大10グラフまで含めることができます。
          </Typography>
        </Box>
      </TabPanel>

      {/* CSVインポートタブ */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <CsvImportPanel />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                データソースについて
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                このダッシュボードは主にe-Stat
                APIから家計調査データを取得しています。
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                e-Stat
                APIで取得できないシードル固有のデータや、業界レポートからの補完データをCSVでインポートできます。
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                インポート可能なカテゴリー
              </Typography>
              <Typography variant="body2" color="text.secondary">
                - ワイン
                <br />
                - 日本酒
                <br />
                - ビール
                <br />
                - 焼酎
                <br />
                - ウイスキー
                <br />
                - シードル
                <br />- その他
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function ReportPage() {
  return <ReportPageContent />;
}
