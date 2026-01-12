/**
 * PDFレポートドキュメントコンポーネント
 * @react-pdf/rendererを使用したA4サイズPDFの生成
 *
 * 仕様:
 * - フォント: Noto Sans JP（日本語対応）
 * - タイトル: 18pt太字
 * - 本文: 12pt
 * - レイアウト: 1ページ1グラフの原則
 * - 余白: 上下左右20mm
 * - グラフサイズ: A4の70%
 * - 最大: 10グラフ（メモリ制約）
 */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Google Fonts - Noto Sans JP（日本語対応フォント）
// https://fonts.google.com/noto/specimen/Noto+Sans+JP
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75g.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFJYi75vNNg.ttf',
      fontWeight: 'bold',
    },
  ],
});

// A4サイズ: 210mm x 297mm
// 余白: 20mm
// 1mm = 2.83465pt
const MM_TO_PT = 2.83465;
const PAGE_WIDTH = 210 * MM_TO_PT;
const PAGE_HEIGHT = 297 * MM_TO_PT;
const MARGIN = 20 * MM_TO_PT;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// PAGE_HEIGHTは将来のレイアウト計算用に保持（現在未使用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN * 2;

// A4の70%サイズでグラフを表示
const CHART_WIDTH = CONTENT_WIDTH * 0.9;
const CHART_HEIGHT = CHART_WIDTH * 0.6; // アスペクト比 約5:3

// スタイル定義
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: MARGIN,
    fontFamily: 'NotoSansJP',
  },
  // 表紙スタイル
  coverPage: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: MARGIN,
    fontFamily: 'NotoSansJP',
    height: '100%',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#558B2F',
    marginBottom: 20,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    textAlign: 'center',
  },
  coverDate: {
    fontSize: 12,
    color: '#888888',
    marginTop: 40,
  },
  // ヘッダー
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#558B2F',
    borderBottomStyle: 'solid',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#558B2F',
  },
  headerPage: {
    fontSize: 10,
    color: '#888888',
  },
  // グラフセクション
  chartSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  chartImage: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    objectFit: 'contain',
  },
  chartCaption: {
    fontSize: 10,
    color: '#666666',
    marginTop: 10,
    textAlign: 'center',
  },
  // フッター
  footer: {
    position: 'absolute',
    bottom: MARGIN,
    left: MARGIN,
    right: MARGIN,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#CCCCCC',
    borderTopStyle: 'solid',
  },
  // コメントページ
  commentPage: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: MARGIN,
    fontFamily: 'NotoSansJP',
  },
  commentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#558B2F',
    marginBottom: 20,
  },
  commentBox: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 4,
  },
  commentText: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.8,
  },
});

/**
 * グラフ画像データ
 */
export interface ChartImage {
  /** グラフのタイトル */
  title: string;
  /** Base64エンコードされた画像データ（data URL形式） */
  dataUrl: string;
  /** キャプション（任意） */
  caption?: string;
}

/**
 * レポートドキュメントのプロパティ
 */
export interface ReportDocumentProps {
  /** レポートタイトル */
  title: string;
  /** 対象期間（開始） */
  dateFrom: string;
  /** 対象期間（終了） */
  dateTo: string;
  /** グラフ画像データの配列（最大10件） */
  charts: ChartImage[];
  /** コメント（任意） */
  comment?: string;
  /** 作成日（デフォルト: 現在日付） */
  createdAt?: string;
}

/**
 * 表紙ページコンポーネント
 */
function CoverPage({
  title,
  dateFrom,
  dateTo,
  createdAt,
}: {
  title: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={styles.coverTitle}>{title}</Text>
        <Text style={styles.coverSubtitle}>
          対象期間: {dateFrom} 〜 {dateTo}
        </Text>
        <Text style={styles.coverDate}>作成日: {createdAt}</Text>
      </View>
      <Text style={styles.footer}>
        シードル市場分析ダッシュボード - 自動生成レポート
      </Text>
    </Page>
  );
}

/**
 * グラフページコンポーネント
 */
function ChartPage({
  chart,
  pageNumber,
  totalPages,
  reportTitle,
}: {
  chart: ChartImage;
  pageNumber: number;
  totalPages: number;
  reportTitle: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{reportTitle}</Text>
        <Text style={styles.headerPage}>
          {pageNumber} / {totalPages}
        </Text>
      </View>

      {/* グラフセクション */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>{chart.title}</Text>
        <Image style={styles.chartImage} src={chart.dataUrl} />
        {chart.caption && (
          <Text style={styles.chartCaption}>{chart.caption}</Text>
        )}
      </View>

      {/* フッター */}
      <Text style={styles.footer}>
        シードル市場分析ダッシュボード - 自動生成レポート
      </Text>
    </Page>
  );
}

/**
 * コメントページコンポーネント
 */
function CommentPage({
  comment,
  pageNumber,
  totalPages,
  reportTitle,
}: {
  comment: string;
  pageNumber: number;
  totalPages: number;
  reportTitle: string;
}) {
  return (
    <Page size="A4" style={styles.commentPage}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{reportTitle}</Text>
        <Text style={styles.headerPage}>
          {pageNumber} / {totalPages}
        </Text>
      </View>

      {/* コメントセクション */}
      <Text style={styles.commentTitle}>コメント</Text>
      <View style={styles.commentBox}>
        <Text style={styles.commentText}>{comment}</Text>
      </View>

      {/* フッター */}
      <Text style={styles.footer}>
        シードル市場分析ダッシュボード - 自動生成レポート
      </Text>
    </Page>
  );
}

/**
 * PDFレポートドキュメントコンポーネント
 *
 * 使用例:
 * ```tsx
 * const MyPDF = () => (
 *   <ReportDocument
 *     title="シードル市場分析レポート"
 *     dateFrom="2024-01"
 *     dateTo="2024-12"
 *     charts={[
 *       { title: "市場規模推移", dataUrl: "data:image/png;base64,..." },
 *       { title: "成長率トレンド", dataUrl: "data:image/png;base64,..." },
 *     ]}
 *     comment="今期のシードル市場は..."
 *   />
 * );
 * ```
 */
export function ReportDocument({
  title,
  dateFrom,
  dateTo,
  charts,
  comment,
  createdAt,
}: ReportDocumentProps) {
  // 現在日付をデフォルトとして使用
  const reportDate =
    createdAt ||
    new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // メモリ制約のため最大10グラフに制限
  const limitedCharts = charts.slice(0, 10);

  // 総ページ数を計算（表紙 + グラフページ + コメントページ（ある場合））
  const hasComment = comment && comment.trim().length > 0;
  const totalPages = 1 + limitedCharts.length + (hasComment ? 1 : 0);

  return (
    <Document>
      {/* 表紙 */}
      <CoverPage
        title={title}
        dateFrom={dateFrom}
        dateTo={dateTo}
        createdAt={reportDate}
      />

      {/* グラフページ（1ページ1グラフ） */}
      {limitedCharts.map((chart, index) => (
        <ChartPage
          key={index}
          chart={chart}
          pageNumber={index + 2} // 表紙の次から
          totalPages={totalPages}
          reportTitle={title}
        />
      ))}

      {/* コメントページ（コメントがある場合のみ） */}
      {hasComment && (
        <CommentPage
          comment={comment || ''}
          pageNumber={totalPages}
          totalPages={totalPages}
          reportTitle={title}
        />
      )}
    </Document>
  );
}

export default ReportDocument;
