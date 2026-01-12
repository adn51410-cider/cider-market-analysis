/**
 * チャートキャプチャユーティリティ
 * html2canvasを使用してRechartsグラフをCanvas/Base64画像化する
 */
import html2canvas from 'html2canvas';

/**
 * キャプチャオプション
 */
interface CaptureOptions {
  /** 出力スケール（デフォルト: 2x = Retina対応） */
  scale?: number;
  /** 背景色（デフォルト: 白） */
  backgroundColor?: string;
  /** 出力画像形式 */
  format?: 'png' | 'jpeg';
  /** JPEG品質（0-1） */
  quality?: number;
}

/**
 * キャプチャ結果
 */
interface CaptureResult {
  /** Base64エンコードされた画像データ（data URL形式） */
  dataUrl: string;
  /** 画像の幅（ピクセル） */
  width: number;
  /** 画像の高さ（ピクセル） */
  height: number;
}

/**
 * 単一のHTML要素をCanvas化してBase64画像として取得
 * @param element キャプチャ対象のHTML要素
 * @param options キャプチャオプション
 * @returns キャプチャ結果（Base64データURL、幅、高さ）
 */
export async function captureElement(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const {
    scale = 2, // Retina対応: 2x解像度
    backgroundColor = '#FFFFFF',
    format = 'png',
    quality = 0.92,
  } = options;

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor,
    logging: false, // コンソールログを抑制
    useCORS: true, // CORS対応（外部画像がある場合）
    allowTaint: false,
  });

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, quality);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * 複数のHTML要素をまとめてキャプチャ
 * @param elements キャプチャ対象のHTML要素配列
 * @param options キャプチャオプション
 * @returns キャプチャ結果の配列
 */
export async function captureMultipleElements(
  elements: HTMLElement[],
  options: CaptureOptions = {}
): Promise<CaptureResult[]> {
  // メモリ制約のため、最大10件に制限
  const MAX_CHARTS = 10;
  const limitedElements = elements.slice(0, MAX_CHARTS);

  // 順次処理（並列だとメモリ使用量が急増する可能性）
  const results: CaptureResult[] = [];

  for (const element of limitedElements) {
    const result = await captureElement(element, options);
    results.push(result);
  }

  return results;
}

/**
 * グラフコンテナ要素のRefから直接キャプチャ
 * ReactのRef<HTMLDivElement>を受け取り、キャプチャを実行
 * @param ref グラフコンテナへのRef
 * @param options キャプチャオプション
 * @returns キャプチャ結果、またはRefが無効な場合はnull
 */
export async function captureFromRef(
  ref: React.RefObject<HTMLDivElement | null>,
  options: CaptureOptions = {}
): Promise<CaptureResult | null> {
  if (!ref.current) {
    return null;
  }

  return captureElement(ref.current, options);
}

/**
 * データURLからBlobを生成
 * @param dataUrl Base64エンコードされたデータURL
 * @returns Blobオブジェクト
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: mimeType });
}

/**
 * Base64データURLから純粋なBase64文字列を抽出
 * @param dataUrl Base64エンコードされたデータURL
 * @returns Base64文字列（data:image/png;base64,プレフィックスなし）
 */
export function extractBase64(dataUrl: string): string {
  const [, base64Data] = dataUrl.split(',');
  return base64Data;
}
