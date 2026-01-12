'use client';

import { useState, useRef, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Checkbox,
  Divider,
  Chip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import { useCsvImport } from '@/hooks/queries';

/**
 * CSVインポート結果の状態
 */
interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * CSVインポートパネル
 *
 * 市場データをCSVファイルからインポートするためのUI
 */
// eslint-disable-next-line max-lines-per-function, complexity
export default function CsvImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { mutate: importCsv, isPending, isError, error, reset } = useCsvImport();

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      reset();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = () => {
    if (!selectedFile) return;

    importCsv(
      { file: selectedFile, overwrite },
      {
        onSuccess: (data) => {
          setResult({
            success: data.success,
            imported: data.imported,
            skipped: data.skipped,
            errors: data.errors,
          });
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
        onError: (err) => {
          setResult({
            success: false,
            imported: 0,
            skipped: 0,
            errors: [err.message],
          });
        },
      }
    );
  };

  const handleDownloadTemplate = () => {
    const template =
      'category,year_month,value,data_type\nシードル,2024-01,50.5,sales\nワイン,2024-01,500.0,sales\n日本酒,2024-01,400.0,sales';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement('a');
    a.href = url;
    a.download = 'market_data_template.csv';
    globalThis.document.body.appendChild(a);
    a.click();
    globalThis.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" color="primary" gutterBottom>
        CSVデータインポート
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        市場データをCSVファイルからインポートします。e-Stat
        APIで取得できないデータを手動で補完する際に使用します。
      </Typography>

      {/* フォーマット説明 */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">CSVフォーマット</Typography>
        <Typography variant="body2">
          必須列: category, year_month, value, data_type
        </Typography>
        <Typography variant="caption" component="div" sx={{ mt: 1 }}>
          - category: 酒類カテゴリー（ワイン, 日本酒, ビール, 焼酎,
          ウイスキー, シードル, その他）
          <br />
          - year_month: 年月（YYYY-MM形式）
          <br />
          - value: 金額（数値）
          <br />- data_type: データ種別（sales, volume, price）
        </Typography>
      </Alert>

      {/* テンプレートダウンロード */}
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleDownloadTemplate}
        size="small"
        sx={{ mb: 3 }}
      >
        テンプレートをダウンロード
      </Button>

      <Divider sx={{ my: 2 }} />

      {/* ファイル選択 */}
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={handleUploadClick}
          disabled={isPending}
        >
          ファイルを選択
        </Button>
        {selectedFile && (
          <Chip
            label={selectedFile.name}
            onDelete={() => {
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            color="primary"
            variant="outlined"
          />
        )}
      </Box>

      {/* オプション */}
      <FormControlLabel
        control={
          <Checkbox
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
        }
        label="既存データを上書きする"
      />

      {/* インポートボタン */}
      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!selectedFile || isPending}
          fullWidth
        >
          {isPending ? 'インポート中...' : 'インポート実行'}
        </Button>
      </Box>

      {/* プログレス */}
      {isPending && <LinearProgress sx={{ mt: 2 }} />}

      {/* エラー表示 */}
      {isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error?.message || 'インポート中にエラーが発生しました'}
        </Alert>
      )}

      {/* 結果表示 */}
      {result && (
        <Box sx={{ mt: 3 }}>
          <Alert
            severity={result.success ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            {result.success
              ? `インポートが完了しました`
              : 'インポートが一部完了しました（エラーあり）'}
          </Alert>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary={`インポート成功: ${result.imported}件`}
              />
            </ListItem>
            {result.skipped > 0 && (
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" />
                </ListItemIcon>
                <ListItemText
                  primary={`スキップ: ${result.skipped}件（既存データ）`}
                />
              </ListItem>
            )}
            {result.errors.length > 0 && (
              <ListItem>
                <ListItemIcon>
                  <ErrorIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={`エラー: ${result.errors.length}件`}
                  secondary={result.errors.slice(0, 5).join(', ')}
                />
              </ListItem>
            )}
          </List>
        </Box>
      )}

      {/* 注意事項 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          注意事項:
          <br />
          - CSVファイルはUTF-8エンコーディングで保存してください
          <br />
          - カテゴリー名は正確に入力してください（全角・半角に注意）
          <br />- 重複データは上書きオプションを有効にすると更新されます
        </Typography>
      </Box>
    </Paper>
  );
}
