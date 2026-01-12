/**
 * PDFエクスポートユーティリティ
 * @react-pdf/rendererを使用してPDFを生成し、ダウンロードを提供
 */
import { pdf, DocumentProps } from '@react-pdf/renderer';
import { ReactElement } from 'react';
import { ReportDocument, ReportDocumentProps, ChartImage } from '@/components/pdf/ReportDocument';
import { captureElement } from './chartCapture';

/**
 * PDFエクスポートオプション
 */
interface PdfExportOptions {
  /** ファイル名（.pdfは自動付与） */
  filename?: string;
}

/**
 * ReactElement（PDFドキュメント）からBlobを生成
 * @param pdfDocument PDFドキュメントコンポーネント
 * @returns PDF Blob
 */
export async function generatePdfBlob(
  pdfDocument: ReactElement<DocumentProps>
): Promise<Blob> {
  const blob = await pdf(pdfDocument).toBlob();
  return blob;
}

/**
 * PDFをダウンロード
 * @param blob PDF Blob
 * @param filename ファイル名（.pdf拡張子を含む）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;

  // ダウンロードをトリガー
  window.document.body.appendChild(link);
  link.click();

  // クリーンアップ
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * PDFドキュメントを生成してダウンロード
 * @param pdfDocument PDFドキュメントコンポーネント
 * @param options エクスポートオプション
 */
export async function exportPdf(
  pdfDocument: ReactElement<DocumentProps>,
  options: PdfExportOptions = {}
): Promise<void> {
  const { filename = generateDefaultFilename() } = options;

  const blob = await generatePdfBlob(pdfDocument);
  downloadBlob(blob, filename);
}

/**
 * デフォルトのファイル名を生成（report_YYYYMMDD.pdf形式）
 * @returns ファイル名
 */
export function generateDefaultFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `report_${year}${month}${day}.pdf`;
}

/**
 * グラフ要素からPDFレポートを生成してダウンロード
 *
 * 処理フロー:
 * 1. 各グラフ要素をhtml2canvasでキャプチャ
 * 2. Base64画像としてReportDocumentに渡す
 * 3. @react-pdf/rendererでPDFを生成
 * 4. BlobURLを作成してダウンロード
 *
 * @param chartElements グラフ要素の配列（{element, title}）
 * @param reportConfig レポート設定
 * @param options エクスポートオプション
 */
export async function generateReportPdf(
  chartElements: Array<{ element: HTMLElement; title: string }>,
  reportConfig: Omit<ReportDocumentProps, 'charts'>,
  options: PdfExportOptions = {}
): Promise<void> {
  // 最大10グラフに制限（メモリ制約）
  const MAX_CHARTS = 10;
  const limitedElements = chartElements.slice(0, MAX_CHARTS);

  // 進捗コールバック（将来の拡張用）
  const charts: ChartImage[] = [];

  // 各グラフをキャプチャ
  for (const { element, title } of limitedElements) {
    const result = await captureElement(element, {
      scale: 2, // Retina対応
      backgroundColor: '#FFFFFF',
      format: 'png',
    });

    charts.push({
      title,
      dataUrl: result.dataUrl,
    });
  }

  // ReportDocumentを生成
  const pdfDocument = ReportDocument({
    ...reportConfig,
    charts,
  });

  // PDFをエクスポート
  await exportPdf(pdfDocument, options);
}

/**
 * 事前キャプチャ済みの画像からPDFレポートを生成してダウンロード
 * （UIでプレビュー表示中に既にキャプチャ済みの場合に使用）
 *
 * @param charts グラフ画像データの配列
 * @param reportConfig レポート設定
 * @param options エクスポートオプション
 */
export async function generateReportPdfFromImages(
  charts: ChartImage[],
  reportConfig: Omit<ReportDocumentProps, 'charts'>,
  options: PdfExportOptions = {}
): Promise<void> {
  // 最大10グラフに制限
  const limitedCharts = charts.slice(0, 10);

  // ReportDocumentを生成
  const pdfDocument = ReportDocument({
    ...reportConfig,
    charts: limitedCharts,
  });

  // PDFをエクスポート
  await exportPdf(pdfDocument, options);
}
